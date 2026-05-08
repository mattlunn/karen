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
  AlexaSmartHomeDirective,
  AlexaAcceptGrantDirective,
  AlexaDiscoverDirective,
  AlexaReportStateDirective,
  AlexaTurnOnOffDirective,
  AlexaBrightnessDirective,
  AlexaSetBrightnessDirective,
  AlexaAdjustBrightnessDirective,
  AlexaSecurityPanelDirective,
  AlexaDirectiveEndpoint
} from '../services/alexa/types';

const router = express.Router();

type AlexaDirectiveWithEndpoint = Extract<AlexaSmartHomeDirective, { endpoint: AlexaDirectiveEndpoint }>;

function stateReport(directive: AlexaDirectiveWithEndpoint, properties: AlexaEndpointProperty[]) {
  return {
    event: {
      header: { ...directive.header, name: 'StateReport' },
      endpoint: directive.endpoint
    },
    context: { properties }
  };
}

function controlResponse(directive: AlexaDirectiveWithEndpoint, properties: AlexaEndpointProperty[]) {
  return {
    event: {
      header: { ...directive.header, namespace: 'Alexa', name: 'Response' },
      endpoint: directive.endpoint
    },
    context: { properties }
  };
}

async function handleDiscover(directive: AlexaDiscoverDirective) {
  const devices = await Device.findAll();
  const endpoints = buildDiscoveryEndpoints(devices);

  return {
    event: {
      header: {
        namespace: 'Alexa.Discovery',
        name: 'Discover.Response',
        messageId: directive.header.messageId,
        payloadVersion: directive.header.payloadVersion
      },
      payload: { endpoints }
    }
  };
}

async function handleAcceptGrant(directive: AlexaAcceptGrantDirective) {
  await exchangeAuthenticationToken('authorization_code', directive.payload.grant.code);

  return {
    event: {
      header: { ...directive.header, name: 'AcceptGrant.Response' }
    }
  };
}

async function handleReportState(directive: AlexaReportStateDirective) {
  const endpointId = directive.endpoint.endpointId;
  const then = new Date();

  if (endpointId === ALARM_ENDPOINT_ID) {
    const activeArming = await Arming.getActiveArming();
    const alarmMode: AlarmMode = activeArming ? activeArming.mode as AlarmMode : 'OFF';

    return stateReport(directive, createAlarmResponseProperties(alarmMode, then, Date.now() - then.valueOf()));
  }

  const device = await Device.findByIdOrError(endpointId);
  const capabilities = device.getCapabilities();

  if (capabilities.includes('LIGHT')) {
    return stateReport(directive, await createLightResponseProperties(device, then, Date.now() - then.valueOf()));
  } else if (capabilities.includes('THERMOSTAT')) {
    return stateReport(directive, await createThermostatResponseProperties(device, then, Date.now() - then.valueOf()));
  } else {
    throw new Error(`Unable to report state on ${endpointId}`);
  }
}

async function handleLightControl(directive: AlexaDirectiveWithEndpoint, update: { isOn?: boolean; brightness?: number }) {
  const id = directive.endpoint.endpointId;
  const device = await Device.findByIdOrError(id);
  const light = device.getLightCapability();
  const then = new Date();

  if ('brightness' in update && update.brightness !== undefined) {
    await light.setBrightness(update.brightness);
  } else if ('isOn' in update && update.isOn !== undefined) {
    await light.setIsOn(update.isOn);
  }

  return controlResponse(directive, await createLightResponseProperties(device, then, Date.now() - then.valueOf()));
}

async function handleAdjustBrightness(directive: AlexaAdjustBrightnessDirective) {
  const id = directive.endpoint.endpointId;
  const device = await Device.findByIdOrError(id);
  const light = device.getLightCapability();
  const delta = directive.payload.brightnessDelta;
  const newBrightness = Math.max(0, Math.min(100, await light.getBrightness() + delta));

  return handleLightControl(directive, { brightness: newBrightness });
}

async function handleAlarmControl(directive: AlexaSecurityPanelDirective) {
  const alarmMode: AlarmMode = directive.header.name === 'Disarm' ? 'OFF' :
    directive.payload.armState === 'ARMED_AWAY' ? 'AWAY' : 'NIGHT';

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

  return controlResponse(directive, createAlarmResponseProperties(alarmMode, now, 0));
}

type DirectiveHandler = (d: AlexaSmartHomeDirective) => Promise<object>;

const directiveHandlers: Record<string, DirectiveHandler> = {
  'Alexa.Discovery': (d) => handleDiscover(d as AlexaDiscoverDirective),
  'Alexa.Authorization': (d) => handleAcceptGrant(d as AlexaAcceptGrantDirective),
  'Alexa': (d) => handleReportState(d as AlexaReportStateDirective),
  'Alexa.PowerController': (d) => handleLightControl(d as AlexaTurnOnOffDirective, { isOn: d.header.name === 'TurnOn' }),
  'Alexa.BrightnessController': (d) => {
    const brightnessDirective = d as AlexaBrightnessDirective;

    if (brightnessDirective.header.name === 'SetBrightness') {
      return handleLightControl(brightnessDirective as AlexaSetBrightnessDirective, { brightness: (brightnessDirective as AlexaSetBrightnessDirective).payload.brightness });
    }

    return handleAdjustBrightness(brightnessDirective as AlexaAdjustBrightnessDirective);
  },
  'Alexa.SecurityPanelController': (d) => handleAlarmControl(d as AlexaSecurityPanelDirective)
};

type SkillRequestHandler = (req: unknown) => Promise<unknown>;

router.post('/smarthome', auth, async (req, res) => {
  const directive = req.body.directive as AlexaSmartHomeDirective;
  const { namespace, messageId } = directive.header;
  const handler = directiveHandlers[namespace];

  if (!handler) {
    res.status(404).json({ error: `No handler for namespace ${namespace}` });
    return;
  }

  try {
    const response = await handler(directive);
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
        endpoint: (directive as AlexaDirectiveWithEndpoint).endpoint,
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
