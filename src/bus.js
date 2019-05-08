import EventEmitter from 'events';

export const FIRST_USER_HOME = 'FIRST_USER_HOME';
export const LAST_USER_LEAVES = 'LAST_USER_LEAVES';
export const MOTION_DETECTED = 'MOTION_DETECTED';
export const NOTIFICATION = 'NOTIFICATION';

export const NEST_OCCUPANCY_STATUS_UPDATE = 'NEST_OCCUPANCY_STATUS_UPDATE';
export const NEST_HEATING_STATUS_UPDATE = 'NEST_HEATING_STATUS_UPDATE';

export default new EventEmitter();