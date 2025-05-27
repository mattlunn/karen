import { PropertyDecoratorOptions } from '.';
import { Device, Event } from '../../models';

export async function booleanGetter(device: Device, property: string) {
  const latestEvent = await device.getLatestEvent(property);

  return !!(latestEvent && !latestEvent.end);
}

export async function booleanSetter(device: Device, property: string, newValue: boolean, timestamp: Date) {
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

export function booleanProperty(name: string, options: PropertyDecoratorOptions) {
  return (target: Function, context: {}) => {
    const { writeable = false, dbName } = options;

    target.prototype[`get${name}`] = async function() {
      return await booleanGetter(this.device, dbName);
    }

    target.prototype[`set${name}State`] = async function(newValue: boolean): Promise<void> {
      return await booleanSetter(this.device, dbName, newValue, new Date());
    }

    if (writeable) {
      target.prototype[`set${name}`] = async function(value: number): Promise<void> {
        return this.handlers[`set${name}`](value);
      }
    }
  }
}
