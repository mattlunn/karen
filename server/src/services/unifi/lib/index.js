import { Controller } from 'node-unifi';
import config from '../../../config.json';

function createController() {
  return new Controller({
    host: config.unifi.host,
    port: config.unifi.port,
    username: config.unifi.username,
    password: config.unifi.password,
  });
}

let controller = createController();
let reauthPromise = null;

async function reauthenticate() {
  if (!reauthPromise) {
    reauthPromise = (async () => {
      controller = createController();
      await controller.login();
    })().finally(() => {
      reauthPromise = null;
    });
  }
  return reauthPromise;
}

async function withRetry(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e?.response?.status === 401) {
      await reauthenticate();
      return fn();
    }
    throw e;
  }
}

export async function getAllUsers() {
  return withRetry(() => controller.getAllUsers());
}

export async function getClientDevices() {
  return withRetry(() => controller.getClientDevices());
}
