import { sendPushNotification } from '../services/pushover';

export function sendNotification(message) {
  console.log(`Sending notification "${message}"`);

  sendPushNotification(message);
}