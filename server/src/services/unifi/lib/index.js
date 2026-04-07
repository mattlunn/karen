import { Controller } from 'node-unifi';
import config from '../../../config.json';
import logger from '../../../logger';

const controller = new Controller({
  host: config.unifi.host,
  port: config.unifi.port,
  username: config.unifi.username,
  password: config.unifi.password,
});

export async function getAllUsers() {
  await controller.login();

  return await controller.getAllUsers();
}

export async function getClientDevices() {
  await controller.login();

  return await controller.getClientDevices();
}
