import EventEmitter from 'events';

export const FIRST_USER_HOME = 'FIRST_USER_HOME';
export const LAST_USER_LEAVES = 'LAST_USER_LEAVES';
export const NOTIFICATION = 'NOTIFICATION';
export const EVENT_START = 'EVENT_START';
export const EVENT_END = 'EVENT_END';
export const STAY_START = 'STAY_START';
export const STAY_END = 'STAY_END';
export const DEVICE_PROPERTY_CHANGED = 'DEVICE_PROPERTY_CHANGED';

const emitter = new EventEmitter();

emitter.setMaxListeners(100);

export default emitter;