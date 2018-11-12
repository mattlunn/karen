import Sequelize from 'sequelize';
import config from '../config';
import userFactory from './user';
import stayFactory from './stay';
import tokenFactory from './token';
import heatingFactory from './heating';
import eventFactory from './event';
import recordingFactory from './recording';

const instance = new Sequelize(config.database.name, config.database.user, config.database.password, {
  dialect: 'mysql',
  logging: false
});

export const User = userFactory(instance);
export const Stay = stayFactory(instance);
export const Token = tokenFactory(instance);
export const Heating = heatingFactory(instance);
export const Event = eventFactory(instance);
export const Recording = recordingFactory(instance);

Recording.belongsTo(Event);
Event.hasOne(Recording);
