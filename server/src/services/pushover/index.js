import Push from 'pushover-notifications';
import config from '../../config';
import logger from '../../logger';
import bus, { NOTIFICATION_TO_ADMINS, NOTIFICATION_TO_ALL } from '../../bus';
import { User } from '../../models';
 
const push = new Push({
  token: config.pushover.application_token,
  onerror: logger.error.bind(logger)
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

  logger.info(`Sending a notification to ${ids.length} user(s)`);

  push.send(event, (err) => {
    if (err) {
      logger.error(err);
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