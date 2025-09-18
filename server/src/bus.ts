import { EventEmitter } from 'events';
import { Stay } from './models';
import { NumericEvent, BooleanEvent } from './models';
import { DeviceCapabilityEvent } from './models/capabilities';

export const FIRST_USER_HOME = 'FIRST_USER_HOME';
export const LAST_USER_LEAVES = 'LAST_USER_LEAVES';
export const NOTIFICATION_TO_ALL = 'NOTIFICATION_TO_ALL';
export const NOTIFICATION_TO_ADMINS = 'NOTIFICATION_TO_ADMINS';
export const STAY_START = 'STAY_START';
export const STAY_END = 'STAY_END';

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

interface KarenEventBus extends EventEmitter {
  emit(event: NotificationEvents, payload: NotificationPayload): boolean;
  on(event: NotificationEvents, cb: (payload: NotificationPayload) => void): this;

  emit(event: StayEvents, payload: Stay): boolean;
  on(event: StayEvents, cb: (payload: Stay) => void): this;

  emit(event: DeviceCapabilityEvent, payload: NumericEvent | BooleanEvent): void;
  on(event: DeviceCapabilityEvent, cb: (payload: NumericEvent) => unknown): this;
  on(event: DeviceCapabilityEvent, cb: (payload: BooleanEvent) => unknown): this;
}

export default emitter;