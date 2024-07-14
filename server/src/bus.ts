import { EventEmitter } from 'events';
import { Device, Event, Stay } from './models';

export const FIRST_USER_HOME = 'FIRST_USER_HOME';
export const LAST_USER_LEAVES = 'LAST_USER_LEAVES';
export const NOTIFICATION_TO_ALL = 'NOTIFICATION_TO_ALL';
export const NOTIFICATION_TO_ADMINS = 'NOTIFICATION_TO_ADMINS';
export const EVENT_START = 'EVENT_START';
export const EVENT_END = 'EVENT_END';
export const STAY_START = 'STAY_START';
export const STAY_END = 'STAY_END';
export const DEVICE_PROPERTY_CHANGED = 'DEVICE_PROPERTY_CHANGED';

const emitter: KarenEventBus = new EventEmitter();

emitter.setMaxListeners(100);

type NotificationEvents = 'NOTIFICATION_TO_ALL' | 'NOTIFICATION_TO_ADMINS';
type StayEvents = 'FIRST_USER_HOME' | 'LAST_USER_LEAVES' | 'STAY_START' | 'STAY_END';

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
  emit(event: NotificationEvents, payload: NotificationPayload): boolean;
  on(event: NotificationEvents, cb: (payload: NotificationPayload) => void): this;

  emit(event: 'DEVICE_PROPERTY_CHANGED', payload: DevicePropertyChangedPayload): boolean;
  on(event: 'DEVICE_PROPERTY_CHANGED', cb: (payload: DevicePropertyChangedPayload) => void): this;

  emit(event: 'EVENT_START' | 'EVENT_END', payload: Event): boolean;
  on(event: 'EVENT_START' | 'EVENT_END', cb: (payload: Event) => void): this;

  emit(event: StayEvents, payload: Stay): boolean;
  on(event: StayEvents, cb: (payload: Stay) => void): this;
}

export default emitter;