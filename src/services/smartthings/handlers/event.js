import { Device } from '../../../models';
import { ensureDeviceEvent } from '../attribute-handlers';

/*
  {
    eventId: '90b5f2f2-bdee-11e9-bf46-ef0055f3e0b7',
    locationId: 'cdd47f4c-74d5-4cdf-a490-8264bbd7f1e9',
    deviceId: '88ea900b-ce47-44fc-a30a-7cdf5c8eacec',
    componentId: 'main',
    capability: 'temperatureMeasurement',
    attribute: 'temperature',
    value: 26,
    valueType: 'string',
    stateChange: true,
    subscriptionName: '1dbd64d8-1f0f-4c35-9320-c65f8cc2ee69'
  }
*/

export default async function ({ eventData }) {
  for (const { deviceEvent: { attribute, deviceId, value } } of eventData.events) {
    const device = await Device.findByProviderId('smartthings', deviceId);

    if (device) {
      if (await ensureDeviceEvent(device, attribute, value, new Date())) {
        console.log(`${attribute}} has changed to ${value} for ${device.name} (${device.id})`);
      }
    }
  }

  return {
    success: true
  };
}