import EventEmitter from 'events';

export const FIRST_USER_HOME = 'FIRST_USER_HOME';
export const LAST_USER_LEAVES = 'LAST_USER_LEAVES';
export const MOTION_DETECTED = 'MOTION_DETECTED';
export const NOTIFICATION = 'NOTIFICATION';
export const EVENT_START = 'EVENT_START';
export const EVENT_END = 'EVENT_END';

export default new EventEmitter();