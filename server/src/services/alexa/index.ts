import config from '../../config';
import { Device } from '../../models';
import { sendChangeReport } from './client';
import sleep from '../../helpers/sleep';
import logger from '../../logger';

export const messages = new Map();

/**
 * This integration is a bit of a hack. Alexa does not allow you to trigger unsolicited TTS.
 *
 * Notifications come close, but don't quite fit the bill (don't actually read out the message, they
 * just go into an "inbox" which a user can read when it's convenient for them).
 *
 * What we instead do is;
 *
 *  1. Register a fake Contact Sensor for each Alexa (this is done in the Discovery response from the smart-home Lambda)
 *  2. Register a Routine (in the Alexa App) so that when the Contact sensor is opened, Alexa asks Karen
 *     for the latest messages
 *  3. Register an Intent ("WhatsTheMessage") which returns whatever text we want Alexa to read out.
 *
 * ... and that is orchestrated within this file. So when the app "say"'s something to Alexa, we trigger
 * the Contact sensor, put the message in the queue, then wait for Alexa to call our Intent to return the
 * message.
 */

Device.registerProvider('alexa', {
  getCapabilities(device: Device) {
    return [
      'SPEAKER'
    ];
  },

  provideSpeakerCapability() {
    return {
      /**
       * Will read out "message" on the Alexa "device". Returns a Promise which will resolve once Alexa picks
       * up the message. There seems to be very little latency between Alexa picking up the message, and reading
       * it out.
       *
       * However, there is often substantial latency (10+ seconds) waiting for Alexa to pick up the message,
       * so this promise will often take a long time to resolve; be aware of awaiting it!
       */
      async emitSound(device: Device, message: string | string[], ttlInSeconds: number = 30): Promise<void> {
        if (Array.isArray(message) && message.length > 5) {
          throw new Error('Amazon only allow a maximum of 5 speech segments');
        }
      
        logger.info('Say called with...');
        logger.info(message);
      
        let fulfilled = false;
        let resolve: () => void;
        let reject: (error: Error) => void;
      
        const promise = new Promise<void>((res, rej) => {
          resolve = () => {
            fulfilled = true;
            res();
          };
      
          reject = (reason) => {
            fulfilled = true;
            rej(reason);
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
      
              logger.error(error);
              reject(new Error(error));
            }
          }
        });
      
        setTimeout(() => {
          if (!fulfilled) {
            const error = 'Message was not picked up by Alexa within the TTL';
      
            logger.error(error);
            reject(new Error(error));
          }
        }, ttlInSeconds * 1000);
      
        sendChangeReport(device.name, {
          namespace: 'Alexa.ContactSensor',
          name: 'detectionState',
          value: 'DETECTED',
          timeOfSample: new Date().toISOString(),
          uncertaintyInMilliseconds: 0
        }, 'PHYSICAL_INTERACTION');
      
        await sleep(10);
      
        sendChangeReport(device.name, {
          namespace: 'Alexa.ContactSensor',
          name: 'detectionState',
          value: 'NOT_DETECTED',
          timeOfSample: new Date().toISOString(),
          uncertaintyInMilliseconds: 0
        }, 'PHYSICAL_INTERACTION');
      
        return promise;
      }
    }
  },

  async synchronize() {
    for (const { id, name } of config.alexa.devices) {
      let knownDevice = await Device.findByProviderId('alexa', id);

      if (!knownDevice) {
        knownDevice = Device.build({
          provider: 'alexa',
          providerId: id,
          manufacturer: 'Amazon',
          model: 'Echo'
        });
      } else if (knownDevice.manufacturer === 'Unknown') {
        knownDevice.manufacturer = 'Amazon';
        knownDevice.model = 'Echo';
      }

      knownDevice.name = name;
      await knownDevice.save();
    }
  }
});