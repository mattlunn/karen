import Sequelize from 'sequelize';
import config from '../config';
import userFactory from './user';
import stayFactory from './stay';
import tokenFactory from './token';
import eventFactory from './event';
import recordingFactory from './recording';
import deviceFactory from './device';
import armingFactoring from './arming';
import alarmActivationFactory from './alarm_activation';

const instance = new Sequelize(config.database.name, config.database.user, config.database.password, {
  dialect: 'mysql',
  logging: false
});

export const User = userFactory(instance);
export const Stay = stayFactory(instance);
export const Token = tokenFactory(instance);
export const Event = eventFactory(instance);
export const Recording = recordingFactory(instance);
export const Device = deviceFactory(instance);
export const Arming = armingFactoring(instance);
export const AlarmActivation = alarmActivationFactory(instance);

Recording.belongsTo(Event);
Stay.belongsTo(User);
Event.hasOne(Recording);
Device.hasMany(Event);
Event.belongsTo(Device);
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

export const Op = Sequelize.Op;
