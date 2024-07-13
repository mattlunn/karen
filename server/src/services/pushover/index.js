import Push from 'pushover-notifications';
import config from '../../config';
import bus, { NOTIFICATION } from '../../bus';
import { User } from '../../models';
 
const push = new Push({
  token: config.pushover.application_token,
  onerror: console.error.bind(console)
});

export function sendPushNotification(message) {
  push.send({
    message: message,
  }, function(err, result) {
    if (err) {
      throw err;
    }

    console.log('Result');
    console.log(result);
  });
}

bus.on(NOTIFICATION, async (e) => {
  const users = await User.getThoseWithPushoverToken();
  const event = {
    ...e,
    user: users.map(x => x.pushoverToken).join(', ')
  };

  if (event.image) {
    event.file = {
      name: 'image.jpg',
      data: event.image
    };

    delete event.image;
  }

  console.log(`Sending a notification to ${users.length} user(s)`);

  push.send(event, (err) => {
    if (err) {
      console.error(err);
    }
  });
});