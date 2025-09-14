import { Device, Event } from "../..";

export async function getBooleanProperty(device: Device, propertyName: string): Promise<boolean> {
  const latestEvent = await device.getLatestEvent(propertyName);
  return !!latestEvent && !latestEvent.end;
}

export async function setBooleanProperty(device: Device, propertyName: string, propertyValue: boolean, timestamp: Date = new Date()): Promise<void> {
  const lastEvent = await device.getLatestEvent(propertyName);
  const valueHasChanged = !lastEvent || !lastEvent.end !== propertyValue;

  if (valueHasChanged) {
    // on -> off (update old, don't create new)
    // off -> on (don't touch old, create new)

    if (lastEvent && propertyValue === false) {
      lastEvent.end = timestamp;
      await lastEvent.save();
    }

    if (propertyValue === true) {
      await Event.create({
        deviceId: device.id,
        start: timestamp,
        value: Number(propertyValue),
        type: propertyName
      });
    }
  }
}