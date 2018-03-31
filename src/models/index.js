import Sequelize from 'sequelize';
import config from '../config';
import userFactory from './user';
import stayFactory from './stay';
import tokenFactory from './token';
import heatingFactory from './heating';

const instance = new Sequelize(config.database.name, config.database.user, config.database.password, {
  dialect: 'mysql',
  logging: false
});

export const User = userFactory(instance);
export const Stay = stayFactory(instance);
export const Token = tokenFactory(instance);
export const Heating = heatingFactory(instance);