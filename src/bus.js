import EventEmitter from 'events';

export const FIRST_USER_HOME = 'FIRST_USER_HOME';
export const LAST_USER_LEAVES = 'LAST_USER_LEAVES';
export const MOTION_DETECTED = 'MOTION_DETECTED';
export const NOTIFICATION = 'NOTIFICATION';

export const NEST_OCCUPANCY_STATUS_CHANGE = 'NEST_OCCUPANCY_STATUS_CHANGE';
export const NEST_HEATING_STATUS_CHANGE = 'NEST_HEATING_STATUS_CHANGE';

export default new EventEmitter();