import bus, { NOTIFICATION }  from '../bus';

export function sendNotification(message, link) {
  bus.emit(NOTIFICATION, {
    value1: message,
    value2: link
  });
}