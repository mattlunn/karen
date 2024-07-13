import { EventEmitter } from 'events';
import { Device, Event } from './models';

export const FIRST_USER_HOME = 'FIRST_USER_HOME';
export const LAST_USER_LEAVES = 'LAST_USER_LEAVES';
export const NOTIFICATION = 'NOTIFICATION';
export const EVENT_START = 'EVENT_START';
export const EVENT_END = 'EVENT_END';
export const STAY_START = 'STAY_START';
export const STAY_END = 'STAY_END';
export const DEVICE_PROPERTY_CHANGED = 'DEVICE_PROPERTY_CHANGED';

const emitter: KarenEventBus = new EventEmitter();

emitter.setMaxListeners(100);

type NotificationPayload = {
  message: string,
  sound?: string,
  priority?: number,
  image?: Buffer
};

type DevicePropertyChangedPayload = {
  device: Device,
  property: string
};

interface KarenEventBus extends EventEmitter {
  emit(event: 'NOTIFICATION', payload: NotificationPayload): boolean;
  on(event: 'NOTIFICATION', cb: (payload: NotificationPayload) => void): this;

  emit(event: 'DEVICE_PROPERTY_CHANGED', payload: DevicePropertyChangedPayload): boolean;
  on(event: 'DEVICE_PROPERTY_CHANGED', cb: (payload: DevicePropertyChangedPayload) => void): this;

  emit(event: 'EVENT_START' | 'EVENT_END', payload: Event): boolean;
  on(event: 'EVENT_START' | 'EVENT_END', cb: (payload: Event) => void): this;
}

export default emitter;