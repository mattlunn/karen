import Sequelize from 'sequelize';
import config from '../config';
import userFactory from './user';
import stayFactory from './stay';
import tokenFactory from './token';
import eventFactory from './event';
import recordingFactory from './recording';
import deviceFactory from './device';

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

Recording.belongsTo(Event);
Stay.belongsTo(User);
Event.hasOne(Recording);
Device.hasMany(Event);
Event.belongsTo(Device);
