import { Sequelize } from 'sequelize';
import config from '../config';
import userFactory, { User } from './user';
import stayFactory, { Stay } from './stay';
import roomFactory, { Room } from './room';
import tokenFactory from './token';
import eventFactory, { Event } from './event';
import recordingFactory, { Recording } from './recording';
import deviceFactory, { Device } from './device';
import armingFactoring from './arming';
import alarmActivationFactory from './alarm_activation';
import logger from '../logger';

const instance = new Sequelize(config.database.name, config.database.user, config.database.password, {
  host: config.database.host,
  dialect: 'mysql',
  logging(query) {
    if (process.env.SEQUELIZE_LOGGING === 'true') {
      logger.debug(query);
    }
  },
});

export const Token = tokenFactory(instance);
export const Arming = armingFactoring(instance);
export const AlarmActivation = alarmActivationFactory(instance);

export { Device } from './device';
export { Event } from './event';
export { Recording } from './recording';
export { User } from './user';
export { Stay } from './stay';
export { Room } from './room';

deviceFactory(instance);
eventFactory(instance);
recordingFactory(instance);
userFactory(instance);
stayFactory(instance);
roomFactory(instance);

Recording.belongsTo(Event);
Stay.belongsTo(User);
Event.hasOne(Recording);
Device.hasMany(Event);
Event.belongsTo(Device);
Room.hasMany(Device);
AlarmActivation.belongsTo(Arming);
Arming.hasMany(AlarmActivation, {
  as: 'AlarmActivations'
});
User.hasMany(AlarmActivation, {
  foreignKey: 'suppressedBy'
});
AlarmActivation.belongsTo(User, {
  foreignKey: 'suppressedBy'
});

export { Op } from 'sequelize';
