import { Event, Device } from '../../../models';

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

const attributeHandlers = {
  switch: {
    valueMapper: (value) => value === 'on',
    eventMapper: () => 'on'
  },

  motion: {
    valueMapper: (value) => value === 'active',
    eventMapper: () => 'motion'
  },

  temperature: {
    valueMapper: (value) => Number(value),
    eventMapper: () => 'temperature'
  }
};

export default async function ({ eventData }) {
  for (const { deviceEvent: { attribute, deviceId, value } } of eventData.events) {
    const attributeHandler = attributeHandlers[attribute];

    if (attributeHandler) {
      const device = await Device.findByProviderId('smartthings', deviceId);

      if (device) {
        const eventType = attributeHandler.eventMapper(attribute);
        const eventValue = attributeHandler.valueMapper(value);

        const lastEvent = await Event.findOne({
          where: {
            deviceId: device.id,
            type: eventType
          },

          order: [['start', 'DESC']]
        });

        if (eventValue === true) {
          if (lastEvent && lastEvent.end === null) {
            console.error(`Cannot process '${eventType}' for device '${device.id}' as previous event has not ended`);
            continue;
          }

          await Event.create({
            deviceType: device.type,
            deviceId: device.id,
            type: eventType,
            value: 1,
            start: Date.now()
          });
        } else if (eventValue === false) {
          if (lastEvent && lastEvent.end !== null) {
            console.error(`Cannot process end of '${eventType}' for device '${device.id}' as there is no open event`);
            continue;
          }

          lastEvent.end = Date.now();
          await lastEvent.save();
        } else if (!lastEvent || lastEvent.value !== eventValue) {
          if (lastEvent) {
            lastEvent.end = Date.now();
            await lastEvent.save();
          }

          await Event.create({
            deviceType: device.type,
            deviceId: device.id,
            type: eventType,
            value: eventValue,
            start: Date.now()
          });
        }
      }
    }
  }

  return {
    success: true
  };
}