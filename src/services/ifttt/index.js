import request from 'request-promise-native';
import config from '../../config';
import bus, * as events from '../../bus';

function constructApiUrl(event) {
  return `https://maker.ifttt.com/trigger/${event}/with/key/${config.ifttt.key}`;
}

Object.keys(events).forEach((event) => {
  if (event !== 'default') {
    bus.on(event, (details = {}) => {
      request.post(constructApiUrl(event.toLowerCase()), {
        body: {
          value1: details.value1,
          value2: details.value2,
          value3: details.value3
        },
        json: true
      }).catch((error) => {
        console.log(`Error whilst notifying IFTTT of ${event}`);
        console.dir(error);
      });
    });
  }
});