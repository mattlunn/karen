export const messages = new Map();

export function say(device, message) {
  if (!messages.has(device.name)) {
    messages.set(device.name, []);
  }

  device.setProperty('push', true);
  messages.get(device.name).push(message);
}