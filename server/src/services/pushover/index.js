import Push from 'pushover-notifications';
import config from '../../config';
import bus, { NOTIFICATION_TO_ADMINS, NOTIFICATION_TO_ALL } from '../../bus';
import { User } from '../../models';
 
const push = new Push({
  token: config.pushover.application_token,
  onerror: console.error.bind(console)
});

function sendNotificationToUsers(ids, e) {
  const event = {
    ...e,
    user: ids.join(', ')
  };

  if (event.image) {
    event.file = {
      name: 'image.jpg',
      data: event.image
    };

    delete event.image;
  }

  console.log(`Sending a notification to ${ids.length} user(s)`);

  push.send(event, (err) => {
    if (err) {
      console.error(err);
    }
  });
}

bus.on(NOTIFICATION_TO_ADMINS, (e) => {
  sendNotificationToUsers([config.pushover.admin_token], e);
});

bus.on(NOTIFICATION_TO_ALL, async (e) => {
  const users = await User.getThoseWithPushoverToken();
  
  sendNotificationToUsers(users.map(x => x.pushoverToken), e);
});