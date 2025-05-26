import { Device, Event } from '../../models';

export async function getter(device: Device, property: string) {
  const latestEvent = await device.getLatestEvent(property);

  return !!(latestEvent && !latestEvent.end);
}

export async function setter(device: Device, property: string, newValue: boolean, timestamp: Date) {
  const lastEvent = await device.getLatestEvent(property);

  if (newValue === true) {
    if (lastEvent && lastEvent.end === null) {
      return;
    }

    await Event.create({
      deviceId: device.id,
      type: property,
      value: 1,
      start: timestamp
    });
  } else { // newValue === false
    if (lastEvent === null || lastEvent.end) {
      return;
    }

    lastEvent.end = timestamp;
    await lastEvent.save();
  }

  device.onPropertyChanged(property);
}