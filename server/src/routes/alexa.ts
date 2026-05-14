import express from 'express';
import { Device, Arming } from '../models';
import { ArmingMode } from '../models/arming';
import { exchangeAuthenticationToken } from '../services/alexa/client';
import { buildDiscoveryEndpoints, ALARM_ENDPOINT_ID } from '../services/alexa';
import auth from '../middleware/auth';
import {
  createLightResponseProperties,
  createThermostatResponseProperties,
  createAlarmResponseProperties,
  AlexaEndpointProperty
} from './alexa-response-helpers';
import * as requestTypes from '../services/alexa/requestTypes';
import { AlarmMode } from '../api/types';
import {
  AlexaSmartHomeRequest,
  AlexaAcceptGrantRequest,
  AlexaDiscoverRequest,
  AlexaReportStateRequest,
  AlexaTurnOnOffRequest,
  AlexaBrightnessRequest,
  AlexaSetBrightnessRequest,
  AlexaAdjustBrightnessRequest,
  AlexaSecurityPanelRequest,
  AlexaRequestEndpoint
} from '../services/alexa/types';

const router = express.Router();

type AlexaRequestWithEndpoint = Extract<AlexaSmartHomeRequest, { endpoint: AlexaRequestEndpoint }>;

function stateReport(request: AlexaRequestWithEndpoint, properties: AlexaEndpointProperty[]) {
  return {
    event: {
      header: { ...request.header, name: 'StateReport' },
      endpoint: request.endpoint
    },
    context: { properties }
  };
}

function controlResponse(request: AlexaRequestWithEndpoint, properties: AlexaEndpointProperty[]) {
  return {
    event: {
      header: { ...request.header, namespace: 'Alexa', name: 'Response' },
      endpoint: request.endpoint
    },
    context: { properties }
  };
}

async function handleDiscover(request: AlexaDiscoverRequest) {
  const devices = await Device.findAll();
  const endpoints = buildDiscoveryEndpoints(devices);

  return {
    event: {
      header: {
        namespace: 'Alexa.Discovery',
        name: 'Discover.Response',
        messageId: request.header.messageId,
        payloadVersion: request.header.payloadVersion
      },
      payload: { endpoints }
    }
  };
}

async function handleAcceptGrant(request: AlexaAcceptGrantRequest) {
  await exchangeAuthenticationToken('authorization_code', request.payload.grant.code);

  return {
    event: {
      header: { ...request.header, name: 'AcceptGrant.Response' }
    }
  };
}

async function handleReportState(request: AlexaReportStateRequest) {
  const endpointId = request.endpoint.endpointId;
  const then = new Date();

  if (endpointId === ALARM_ENDPOINT_ID) {
    const activeArming = await Arming.getActiveArming();
    const alarmMode: AlarmMode = activeArming ? activeArming.mode as AlarmMode : 'OFF';

    return stateReport(request, createAlarmResponseProperties(alarmMode, then, Date.now() - then.valueOf()));
  }

  const device = await Device.findByIdOrError(endpointId);
  const capabilities = device.getCapabilities();

  if (capabilities.includes('LIGHT')) {
    return stateReport(request, await createLightResponseProperties(device, then, Date.now() - then.valueOf()));
  } else if (capabilities.includes('THERMOSTAT')) {
    return stateReport(request, await createThermostatResponseProperties(device, then, Date.now() - then.valueOf()));
  } else {
    throw new Error(`Unable to report state on ${endpointId}`);
  }
}

async function handleLightControl(request: AlexaRequestWithEndpoint, update: { isOn?: boolean; brightness?: number }) {
  const id = request.endpoint.endpointId;
  const device = await Device.findByIdOrError(id);
  const light = device.getLightCapability();
  const then = new Date();

  if ('brightness' in update && update.brightness !== undefined) {
    await light.setBrightness(update.brightness);
  } else if ('isOn' in update && update.isOn !== undefined) {
    await light.setIsOn(update.isOn);
  }

  return controlResponse(request, await createLightResponseProperties(device, then, Date.now() - then.valueOf()));
}

async function handleAdjustBrightness(request: AlexaAdjustBrightnessRequest) {
  const id = request.endpoint.endpointId;
  const device = await Device.findByIdOrError(id);
  const light = device.getLightCapability();
  const delta = request.payload.brightnessDelta;
  const newBrightness = Math.max(0, Math.min(100, await light.getBrightness() + delta));

  return handleLightControl(request, { brightness: newBrightness });
}

async function handleAlarmControl(request: AlexaSecurityPanelRequest) {
  const alarmMode: AlarmMode = request.header.name === 'Disarm' ? 'OFF' :
    request.payload.armState === 'ARMED_AWAY' ? 'AWAY' : 'NIGHT';

  const currentArming = await Arming.getActiveArming();
  const now = new Date();

  if (!((currentArming === null && alarmMode === 'OFF') || currentArming?.mode === alarmMode)) {
    if (currentArming !== null) {
      currentArming.end = now;
      await currentArming.save();
    }

    if (alarmMode !== 'OFF') {
      await Arming.create({
        start: now,
        mode: alarmMode === 'AWAY' ? ArmingMode.AWAY : ArmingMode.NIGHT
      });
    }
  }

  return controlResponse(request, createAlarmResponseProperties(alarmMode, now, 0));
}

type SmartHomeRequestHandler = (r: AlexaSmartHomeRequest) => Promise<object>;

const smarthomeHandlers: Record<string, SmartHomeRequestHandler> = {
  'Alexa.Discovery': (r) => handleDiscover(r as AlexaDiscoverRequest),
  'Alexa.Authorization': (r) => handleAcceptGrant(r as AlexaAcceptGrantRequest),
  'Alexa': (r) => handleReportState(r as AlexaReportStateRequest),
  'Alexa.PowerController': (r) => handleLightControl(r as AlexaTurnOnOffRequest, { isOn: r.header.name === 'TurnOn' }),
  'Alexa.BrightnessController': (r) => {
    const brightnessRequest = r as AlexaBrightnessRequest;

    if (brightnessRequest.header.name === 'SetBrightness') {
      return handleLightControl(brightnessRequest as AlexaSetBrightnessRequest, { brightness: (brightnessRequest as AlexaSetBrightnessRequest).payload.brightness });
    }

    return handleAdjustBrightness(brightnessRequest as AlexaAdjustBrightnessRequest);
  },
  'Alexa.SecurityPanelController': (r) => handleAlarmControl(r as AlexaSecurityPanelRequest)
};

type SkillRequestHandler = (req: unknown) => Promise<unknown>;

router.post('/smarthome', auth, async (req, res) => {
  const request = req.body.directive as AlexaSmartHomeRequest;
  const { namespace, messageId } = request.header;
  const handler = smarthomeHandlers[namespace];

  if (!handler) {
    res.status(404).json({ error: `No handler for namespace ${namespace}` });
    return;
  }

  try {
    const response = await handler(request);
    res.json(response);
  } catch (e) {
    res.json({
      event: {
        header: {
          namespace: 'Alexa',
          name: 'ErrorResponse',
          messageId,
          payloadVersion: 3
        },
        endpoint: (request as AlexaRequestWithEndpoint).endpoint,
        payload: {
          type: 'INTERNAL_ERROR',
          message: (e as Error).message
        }
      }
    });
  }
});

router.post('/skill', auth, async (req, res) => {
  const type = (req.body as { request: { type: string } }).request.type;
  const handler = (requestTypes as Record<string, SkillRequestHandler>)[type];

  if (!handler) {
    res.status(404).send('No handler setup to handle ' + type);
    return;
  }

  const response = await handler((req.body as { request: unknown }).request);
  res.status(200).json({ version: '1.0', response });
});

export default router;
