import { EventEmitter } from 'events';
import { Stay } from './models';
import { NumericEvent, BooleanEvent, StringEvent, Log } from './models';
import { DeviceCapabilityEvent } from './models/capabilities';

export const FIRST_USER_HOME = 'FIRST_USER_HOME';
export const LAST_USER_LEAVES = 'LAST_USER_LEAVES';
export const LOG_CREATED = 'LOG_CREATED';
export const STAY_START = 'STAY_START';
export const STAY_END = 'STAY_END';

const emitter: KarenEventBus = new EventEmitter();

emitter.setMaxListeners(100);

type LogCreatedEvents = 'LOG_CREATED';
type StayEvents = 'FIRST_USER_HOME' | 'LAST_USER_LEAVES' | 'STAY_START' | 'STAY_END';

type LogCreatedPayload = {
  log: Log,
  image?: Buffer,
  sound?: string
};

interface KarenEventBus extends EventEmitter {
  emit(event: LogCreatedEvents, payload: LogCreatedPayload): boolean;
  emit(event: StayEvents, payload: Stay): boolean;
  emit(event: DeviceCapabilityEvent, payload: NumericEvent | BooleanEvent | StringEvent): void;

  on(event: LogCreatedEvents, cb: (payload: LogCreatedPayload) => void): this;
  on(event: StayEvents, cb: (payload: Stay) => void): this;
  on(event: DeviceCapabilityEvent, cb: (payload: NumericEvent) => unknown): this;
  on(event: DeviceCapabilityEvent, cb: (payload: BooleanEvent) => unknown): this;
  on(event: DeviceCapabilityEvent, cb: (payload: StringEvent) => unknown): this;
}

export default emitter;
