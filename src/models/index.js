import Sequelize from 'sequelize';
import config from '../config';
import userFactory from './user';
import stayFactory from './stay';

const instance = new Sequelize(config.database.name, config.database.user, config.database.password, {
  dialect: 'mysql'
});

export const User = userFactory(instance);
export const Stay = stayFactory(instance);