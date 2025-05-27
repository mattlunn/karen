import { PropertyDecoratorOptions } from '.';
import { Device, Event } from '../../models';

export async function numericGetter(device: Device, property: string): Promise<number> {
  const latestEvent = await device.getLatestEvent(property);

  return latestEvent?.value ?? 0;
}

export async function numericSetter(device: Device, property: string, newValue: number, timestamp: Date) {
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

export function numericProperty(name: string, options: PropertyDecoratorOptions) {
  return (target: Capability, context: {}) => {
    const { writeable = false, dbName } = options;

    target.prototype[`get${name}`] = async function() {
      return numericGetter(this.device, dbName);
    }

    target.prototype[`set${name}State`] = async function(newValue: number): Promise<void> {
      return numericSetter(this.device, dbName, newValue, new Date());
    }

    if (writeable) {
      target.prototype[`set${name}`] = async function(value: number): Promise<void> {
        return this.handlers[`set${name}`](value);
      }
    }
  }
}
