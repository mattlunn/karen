import config from '../../../config';
import logger from '../../../logger';
import { Device } from '../../../models';
import { makeEventsRequest } from './client';
import { buildDiscoveryEndpoints } from './discovery';
import {
  handleDiscover,
  handleAcceptGrant,
  handleReportState,
  handleLightControl,
  handleAlarmControl,
  AlexaRequestWithEndpoint
} from './handlers';
import {
  AlexaSmartHomeRequest,
  AlexaTurnOnOffRequest,
  AlexaBrightnessRequest,
  AlexaDiscoverRequest,
  AlexaAcceptGrantRequest,
  AlexaReportStateRequest,
  AlexaSecurityPanelRequest
} from './types';

export type { AlexaRequestWithEndpoint };

async function sendAddOrUpdateReport(endpoints: unknown[]): Promise<void> {
  await makeEventsRequest('Alexa.Discovery', 'AddOrUpdateReport', '3', undefined, (bearer) => ({
    payload: {
      endpoints,
      scope: { type: 'BearerToken', token: bearer }
    }
  }));
}

async function sendDeleteReport(endpointIds: string[]): Promise<void> {
  await makeEventsRequest('Alexa.Discovery', 'DeleteReport', '3', undefined, (bearer) => ({
    payload: {
      endpoints: endpointIds.map(endpointId => ({ endpointId })),
      scope: { type: 'BearerToken', token: bearer }
    }
  }));
}

export async function sendSimpleEventSource(deviceId: number | string): Promise<void> {
  const endpointId = String(deviceId);
  const instanceId = `${endpointId}-1`;

  await makeEventsRequest('Alexa.SimpleEventSource', 'Event', '1.0', instanceId, (bearer) => ({
    endpoint: {
      scope: { type: 'BearerToken', token: bearer },
      endpointId
    },
    payload: {
      id: 'Button.SinglePush.1',
      timestamp: new Date().toISOString()
    }
  }));
}

export async function syncDiscovery(): Promise<void> {
  const allDevices = await Device.findAll({ paranoid: false });
  const activeEndpoints = buildDiscoveryEndpoints(allDevices.filter(d => !d.isSoftDeleted()));
  const deletedEndpointIds = allDevices.filter(d => d.isSoftDeleted()).map(d => String(d.id));

  await sendAddOrUpdateReport(activeEndpoints);

  if (deletedEndpointIds.length > 0) {
    await sendDeleteReport(deletedEndpointIds);
  }

  logger.info(`Alexa discovery sync complete: reported ${activeEndpoints.length} endpoints, deleted ${deletedEndpointIds.length}`);
}

export type SmartHomeRequestHandler = (r: AlexaSmartHomeRequest) => Promise<object>;

export const smarthomeHandlers: Record<string, SmartHomeRequestHandler> = {
  'Alexa.Discovery': (r) => handleDiscover(r as AlexaDiscoverRequest),
  'Alexa.Authorization': (r) => handleAcceptGrant(r as AlexaAcceptGrantRequest),
  'Alexa': (r) => handleReportState(r as AlexaReportStateRequest),
  'Alexa.PowerController': (r) => handleLightControl(r as AlexaTurnOnOffRequest),
  'Alexa.BrightnessController': (r) => handleLightControl(r as AlexaBrightnessRequest),
  'Alexa.SecurityPanelController': (r) => handleAlarmControl(r as AlexaSecurityPanelRequest)
};
