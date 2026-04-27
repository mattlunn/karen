import express from 'express';
import { Device, Arming } from '../models';
import { ArmingMode } from '../models/arming';
import { exchangeAuthenticationToken } from '../services/alexa/client';
import { buildDiscoveryEndpoints, ALARM_ENDPOINT_ID } from '../services/alexa';
import auth from '../middleware/auth';
import { mapDeviceToResponse } from './api/device-helpers';
import {
  createLightResponseProperties,
  createThermostatResponseProperties,
  createAlarmResponseProperties,
  AlexaEndpointProperty
} from './alexa-response-helpers';
import * as requestTypes from '../services/alexa/requestTypes';
import { AlarmMode } from '../api/types';

const router = express.Router();

interface AlexaDirectiveHeader {
  namespace: string;
  name: string;
  messageId: string;
  payloadVersion: number | string;
}

interface AlexaDirectiveEndpoint {
  scope: { type: string; token: string };
  endpointId: string;
}

interface AlexaDirective {
  header: AlexaDirectiveHeader;
  endpoint?: AlexaDirectiveEndpoint;
  payload: Record<string, unknown>;
}

function stateReport(directive: AlexaDirective, properties: AlexaEndpointProperty[]) {
  return {
    event: {
      header: { ...directive.header, name: 'StateReport' },
      endpoint: directive.endpoint
    },
    context: { properties }
  };
}

function controlResponse(directive: AlexaDirective, properties: AlexaEndpointProperty[]) {
  return {
    event: {
      header: { ...directive.header, namespace: 'Alexa', name: 'Response' },
      endpoint: directive.endpoint
    },
    context: { properties }
  };
}

async function handleDiscover(directive: AlexaDirective) {
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

async function handleAcceptGrant(directive: AlexaDirective) {
  const code = (directive.payload as { grant: { code: string } }).grant.code;
  await exchangeAuthenticationToken('authorization_code', code);
  return {
    event: {
      header: { ...directive.header, name: 'AcceptGrant.Response' }
    }
  };
}

async function handleReportState(directive: AlexaDirective) {
  const endpointId = directive.endpoint!.endpointId;
  const then = new Date();

  if (endpointId === ALARM_ENDPOINT_ID) {
    const activeArming = await Arming.getActiveArming();
    const alarmMode: AlarmMode = activeArming ? activeArming.mode as AlarmMode : 'OFF';
    return stateReport(directive, createAlarmResponseProperties(alarmMode, then, Date.now() - then.valueOf()));
  }

  const device = await Device.findById(endpointId);
  if (!device) throw new Error(`Device ${endpointId} not found`);
  const deviceResponse = await mapDeviceToResponse(device);
  const capType = deviceResponse.capabilities.find(c => c.type === 'LIGHT' || c.type === 'THERMOSTAT');

  switch (capType?.type) {
    case 'LIGHT':
      return stateReport(directive, createLightResponseProperties(deviceResponse, then, Date.now() - then.valueOf()));
    case 'THERMOSTAT':
      return stateReport(directive, createThermostatResponseProperties(deviceResponse, then, Date.now() - then.valueOf()));
    default:
      throw new Error(`Unable to report state on ${endpointId}`);
  }
}

async function handleLightControl(directive: AlexaDirective, update: { isOn?: boolean; brightness?: number }) {
  const id = directive.endpoint!.endpointId;
  const device = await Device.findById(id);
  if (!device) throw new Error(`Device ${id} not found`);

  const light = device.getLightCapability();
  if (!light) throw new Error(`Device ${id} does not have light capability`);

  const then = new Date();

  if ('brightness' in update && update.brightness !== undefined) {
    await light.setBrightness(update.brightness);
  } else if ('isOn' in update && update.isOn !== undefined) {
    await light.setIsOn(update.isOn);
  }

  const deviceResponse = await mapDeviceToResponse(device);
  return controlResponse(directive, createLightResponseProperties(deviceResponse, then, Date.now() - then.valueOf()));
}

async function handleAlarmControl(directive: AlexaDirective, name: string) {
  const payload = directive.payload as { armState?: string };
  const alarmMode: AlarmMode = name === 'Disarm' ? 'OFF' :
    payload.armState === 'ARMED_AWAY' ? 'AWAY' : 'NIGHT';

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

router.post('/endpoint', auth, async (req, res) => {
  const body = req.body as Record<string, unknown>;

  if ('directive' in body) {
    const directive = body.directive as AlexaDirective;
    const { namespace, name, messageId } = directive.header;

    try {
      let response: object;

      switch (namespace) {
        case 'Alexa.Discovery':
          response = await handleDiscover(directive);
          break;
        case 'Alexa.Authorization':
          response = await handleAcceptGrant(directive);
          break;
        case 'Alexa':
          response = await handleReportState(directive);
          break;
        case 'Alexa.PowerController':
          response = await handleLightControl(directive, { isOn: name === 'TurnOn' });
          break;
        case 'Alexa.BrightnessController': {
          if (name === 'SetBrightness') {
            response = await handleLightControl(directive, { brightness: (directive.payload as { brightness: number }).brightness });
          } else {
            const id = directive.endpoint!.endpointId;
            const device = await Device.findById(id);
            if (!device) throw new Error(`Device ${id} not found`);
            const deviceResponse = await mapDeviceToResponse(device);
            const lightCap = deviceResponse.capabilities.find(c => c.type === 'LIGHT');
            if (!lightCap || lightCap.type !== 'LIGHT') throw new Error(`Device ${id} does not have light capability`);
            const delta = (directive.payload as { brightnessDelta: number }).brightnessDelta;
            const newBrightness = Math.max(0, Math.min(100, lightCap.brightness.value + delta));
            response = await handleLightControl(directive, { brightness: newBrightness });
          }
          break;
        }
        case 'Alexa.SecurityPanelController':
          response = await handleAlarmControl(directive, name);
          break;
        default:
          res.status(404).json({ error: `No handler for namespace ${namespace}` });
          return;
      }

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
          endpoint: directive.endpoint,
          payload: {
            type: 'INTERNAL_ERROR',
            message: (e as Error).message
          }
        }
      });
    }
  } else {
    const requestBody = body as { request: { type: string } };
    const type = requestBody.request.type;

    if (Object.prototype.hasOwnProperty.call(requestTypes, type)) {
      const response = await (requestTypes as Record<string, (req: unknown) => Promise<unknown>>)[type](requestBody.request);
      res.status(200).json({ version: '1.0', response });
    } else {
      res.status(404).send('No handler setup to handle ' + type);
    }
  }
});

router.post('/grant', auth, (req, res) => {
  exchangeAuthenticationToken('authorization_code', JSON.parse(req.body as string).code).then(() => {
    res.sendStatus(204);
  }, () => {
    res.sendStatus(500);
  });
});

export default router;
