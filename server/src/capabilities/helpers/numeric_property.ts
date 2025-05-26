import { Device, Event } from '../../models';

export async function getter(device: Device, property: string): Promise<number> {
  const latestEvent = await device.getLatestEvent(property);

  return latestEvent?.value ?? 0;
}


export async function setter(device: Device, property: string, newValue: number, timestamp: Date) {
  const latestEvent = await device.getLatestEvent(property);

  if (!latestEvent || latestEvent.value !== newValue) {
    if (latestEvent) {
      latestEvent.end = timestamp;
      await latestEvent.save();
    }

    await Event.create({
      deviceId: device.id,
      type: property,
      value: newValue,
      start: timestamp
    });
  }

  device.onPropertyChanged(property);
}