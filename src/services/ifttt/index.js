import request from 'request-promise-native';
import config from '../../config';
import bus, { LAST_USER_LEAVES, FIRST_USER_HOME } from '../../bus';

function constructApiUrl(event) {
  return `https://maker.ifttt.com/trigger/${event}/with/key/${config.ifttt.key}`;
}

[LAST_USER_LEAVES, FIRST_USER_HOME].forEach((event) => {
  bus.on(event, () => {
    request.post(constructApiUrl(event.toLowerCase())).catch((error) => {
      console.log(`Error whilst notifying IFTTT of ${event}`);
      console.dir(error);
    });
  });
});