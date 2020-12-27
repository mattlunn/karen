export const messages = new Map();

/**
 * This integration is a bit of a hack. Alexa does not allow you to trigger unsolicited TTS.
 *
 * Notifications come close, but don't quite fit the bill (don't actually read out the message, they
 * just go into an "inbox" which a user can read when it's convenient for them).
 *
 * What we instead do is;
 *
 *  1. Register a fake Contact Sensor (this was done in the SmartThings Graph UI).
 *  2. Register a Routine (in the Alexa App) so that when the Contact sensor is opened, Alexa asks Karen
 *     for the latest messages
 *  3. Register an Intent ("WhatsTheMessage") which returns whatever text we want Alexa to read out.
 *
 * ... and that is orchestrated within this file. So when the app "say"'s something to Alexa, we trigger
 * the Contact sensor, put the message in the queue, then wait for Alexa to call our Intent to return the
 * message.
 */

/**
 * Will read out "message" on the Alexa "device". Returns a Promise which will resolve once Alexa picks
 * up the message. There seems to be very little latency between Alexa picking up the message, and reading
 * it out.
 *
 * However, there is often substantial latency (10+ seconds) waiting for Alexa to pick up the message,
 * so this promise will often take a long time to resolve; be aware of awaiting it!
 */
export async function say(device, message, ttlInSeconds = 30) {
  if (Array.isArray(message) && message.length > 5) {
    throw new Error('Amazon only allow a maximum of 5 speech segments');
  }

  console.log('Say called with...');
  console.log(message);

  let fulfilled = false;
  let resolve, reject;

  const promise = new Promise((res, rej) => {
    resolve = (reason) => {
      fulfilled = true;
      res(reason);
    };

    reject = (reason) => {
      fulfilled = true;
      res(reason);
    };
  });

  if (messages.has(device.name)) {
    messages.get(device.name).markMessageAsReplaced();
  }

  messages.set(device.name, {
    getMessageToSend() {
      if (fulfilled) {
        return null;
      }

      resolve();
      return Array.isArray(message) ? message.join('') : message;
    },

    markMessageAsReplaced() {
      if (!fulfilled) {
        const error = 'Message was not picked up by Alexa within the TTL';

        console.error(error);
        reject(new Error(error));
      }
    }
  });

  setTimeout(() => {
    if (!fulfilled) {
      const error = 'Message was not picked up by Alexa within the TTL';

      console.error(error);
      reject(new Error(error));
    }
  }, ttlInSeconds * 1000);

  device.setProperty('push', true);
  return promise;
}