import EventEmitter from 'events';

export const FIRST_USER_HOME = 'FIRST_USER_HOME';
export const LAST_USER_LEAVES = 'LAST_USER_LEAVES';
export const MOTION_DETECTED = 'MOTION_DETECTED';

export default new EventEmitter();