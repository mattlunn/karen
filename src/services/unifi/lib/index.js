import { Controller } from 'node-unifi';
import config from '../../../config.json';

const controller = new Controller(config.unifi.host, config.unifi.port);
const session = new Promise((res, rej) => {
  controller.login(config.unifi.username, config.unifi.password, function (err) {
    if (err) rej(err);
    else res();
  });
});

export async function getAllUsers() {
  await session;

  return new Promise((res, rej) => {
    controller.getAllUsers(config.unifi.site, function(err, users) {
      if (err) rej(err);
      else res(users[0]);
    });
  });
}

export async function getClientDevices() {
  await session;

  return new Promise((res, rej) => {
    controller.getClientDevices(config.unifi.site, function(err, devices) {
      if (err) rej(err);
      else res(devices[0]);
    });
  });
}