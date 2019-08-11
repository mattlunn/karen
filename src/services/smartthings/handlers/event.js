import { Event, Device } from '../../../models';

const attributeHandlers = {
  switch: {
    valueMapper: (value) => Number(value === 'on'),
    eventMapper: () => 'on'
  },

  motion: {
    valueMapper: (value) => Number(value === 'active'),
    eventMapper: () => 'motion'
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

        if (eventValue === 1) {
          if (lastEvent && lastEvent.end === null) {
            console.error(`Cannot process '${eventType}' for device '${device.id}' as previous event has not ended`);
            continue;
          }

          await Event.create({
            deviceType: device.type,
            deviceId: device.id,
            type: eventType,
            value: eventValue,
            start: Date.now()
          });
        } else if (eventValue === 0) {
          if (lastEvent && lastEvent.end !== null) {
            console.error(`Cannot process end of '${eventType}' for device '${device.id}' as there is no open event`);
            continue;
          }

          lastEvent.end = Date.now();
          await lastEvent.save();
        } else {
          console.log(`Cannot process eventValue of '${eventValue}' for ${eventType} event`);
        }
      }
    }
  }

  return {
    success: true
  };
}