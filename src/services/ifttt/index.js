import request from 'request-promise-native';
import config from '../../config';
import bus, { NOTIFICATION } from '../../bus';

bus.on(NOTIFICATION, ({ value1, value2, value3 }) => {
  request.post(`https://maker.ifttt.com/trigger/notification/with/key/${config.ifttt.key}`, {
    body: {
      value1,
      value2,
      value3
    },
    json: true
  }).catch((error) => {
    console.log(`Error whilst notifying IFTTT of notification`);
    console.dir(error);
  });
});