import { Controller } from 'node-unifi';
import config from '../../../config.json';
import logger from '../../../logger';

const controller = new Controller({
  host: config.unifi.host,
  port: config.unifi.port,
  site: config.unifi.site,
  sslverify: false
});

async function ensureSession(name, fn) {
  try {
    return await fn();
  } catch (err) {
    if (err.message === 'api.err.LoginRequired') {
      logger.error(`UniFi ${name} call failed because authentication required. Logging in and retrying...`);
      await controller.login(config.unifi.username, config.unifi.password);
      return await fn();
    }
    logger.error(`UniFi ${name} call failed`, err);
    throw err;
  }
}

export function getAllUsers() {
  return ensureSession('getAllUsers', () => controller.getAllUsers());
}

export function getClientDevices() {
  return ensureSession('getClientDevices', () => controller.getClientDevices());
}
