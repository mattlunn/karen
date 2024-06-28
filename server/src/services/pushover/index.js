import Push from 'pushover-notifications';
import config from '../../config';
 
const push = new Push({
  user: config.pushover.user_token,
  token: config.pushover.application_token
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