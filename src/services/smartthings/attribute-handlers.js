import { Event } from '../../models';

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
  },

  contact: {
    valueMapper: (value) => value === 'open',
    eventMapper: () => 'open'
  },

  humidity: {
    valueMapper: (value) => Number(value),
    eventMapper: () => 'humidity'
  },

  level: {
    valueMapper: (value) => Number(value),
    eventMapper: () => 'brightness'
  },

  illuminance: {
    valueMapper: (value) => Number(value),
    eventMapper: () => 'illuminance'
  }
};

export async function ensureDeviceEvent(device, attributeName, attributeValue, changeTimestamp = Date.now()) {
  const attributeHandler = attributeHandlers[attributeName];

  if (attributeHandler) {
    const eventType = attributeHandler.eventMapper(attributeName);
    const eventValue = attributeHandler.valueMapper(attributeValue);

    const lastEvent = await Event.findOne({
      where: {
        deviceId: device.id,
        type: eventType
      },

      order: [['start', 'DESC']]
    });

    if (eventValue === true) {
      if (lastEvent && lastEvent.end === null) {
        return false;
      }

      await Event.create({
        deviceId: device.id,
        type: eventType,
        value: 1,
        start: changeTimestamp
      });
    } else if (eventValue === false) {
      if (lastEvent && lastEvent.end !== null) {
        return false;
      }

      lastEvent.end = changeTimestamp;
      await lastEvent.save();
    } else if (!lastEvent || lastEvent.value !== eventValue) {
      if (lastEvent) {
        lastEvent.end = changeTimestamp;
        await lastEvent.save();
      }

      await Event.create({
        deviceId: device.id,
        type: eventType,
        value: eventValue,
        start: changeTimestamp
      });
    } else {
      return false;
    }

    device.onPropertyChanged(eventType);

    return true;
  }
}