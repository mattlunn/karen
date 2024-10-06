import { Controller } from 'node-unifi';
import config from '../../../config.json';
import logger from '../../../logger';

const controller = new Controller(config.unifi.host, config.unifi.port);

function ensureSession(name, factory) {
  return new Promise((res, rej) => {
    (function tryRunFactory(retryCount) {
      factory(function (err, [data]) {
        if (!err) {
          res(data);
        } else if (retryCount === 0) {
          logger.error(`UniFi ${name} call failed after multiple retries. Giving up`);
          rej(err);
        } else if (err === 'api.err.LoginRequired') {
          logger.error(`UniFi ${name} call failed because authentication required. Logging in and retrying...`);
          controller.login(config.unifi.username, config.unifi.password, () => tryRunFactory(retryCount - 1));
        } else {
          logger.error(`UniFi ${name} call failed because of an error. Retrying`, err);
          tryRunFactory(retryCount - 1);
        }
      });
    }(1));
  });
}

export function getAllUsers() {
  return ensureSession('getAllUsers', controller.getAllUsers.bind(controller, config.unifi.site));
}

export function getClientDevices() {
  return ensureSession('getClientDevices', controller.getClientDevices.bind(controller, config.unifi.site));
}