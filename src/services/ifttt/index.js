import request from 'request-promise-native';
import config from '../../config';
import bus, * as events from '../../bus';

function constructApiUrl(event) {
  return `https://maker.ifttt.com/trigger/${event}/with/key/${config.ifttt.key}`;
}

Object.keys(events).forEach((event) => {
  if (event !== 'default') {
    bus.on(event, () => {
      request.post(constructApiUrl(event.toLowerCase())).catch((error) => {
        console.log(`Error whilst notifying IFTTT of ${event}`);
        console.dir(error);
      });
    });
  }
});