import bus, { NOTIFICATION }  from '../bus';

export function sendNotification(message, link) {
  console.log(`Sending notification "${message}"`);

  bus.emit(NOTIFICATION, {
    value1: message,
    value2: link
  });
}