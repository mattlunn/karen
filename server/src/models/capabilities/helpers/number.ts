import { Device, Event } from "../..";

export async function getNumericProperty(device: Device, propertyName: string, defaultValue: number = 0): Promise<number> {
  return (await device.getLatestEvent(propertyName))?.value ?? defaultValue;
}

export async function setNumericProperty(device: Device, propertyName: string, propertyValue: number, timestamp: Date = new Date()): Promise<void> {
  const lastEvent = await device.getLatestEvent(propertyName);
  const valueHasChanged = !lastEvent || propertyValue !== lastEvent.value

  if (valueHasChanged) {
    if (lastEvent) {
      lastEvent.end = timestamp;
      await lastEvent.save();
    }

    await Event.create({
      deviceId: device.id,
      start: timestamp,
      value: propertyValue,
      type: propertyName
    });

    device.onPropertyChanged(propertyName);
  }
}