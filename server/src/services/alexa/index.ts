import config from '../../config';
import { Device } from '../../models';
import { DeviceCapabilityEvents } from '../../models/capabilities';
import { sendSimpleEventSourceTrigger } from './client';
import logger from '../../logger';

export const messages = new Map();

/**
 * Alexa does not allow unsolicited TTS, so we use Alexa.SimpleEventSource to trigger a Routine.
 *
 * Each Alexa speaker device is exposed as a SimpleEventSource endpoint. When say() is called:
 *  1. The message is stored in the messages Map
 *  2. A SimpleEventSource trigger is sent to Alexa via the Events API
 *  3. The user's Routine fires (triggered by the SimpleEventSource event)
 *  4. The Routine calls the WhatsTheMessage Intent, which retrieves and reads the message
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
      async emitSound(device: Device, message: string | string[], ttlInSeconds = 30): Promise<void> {
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
      
        sendSimpleEventSourceTrigger(device.name);
      
        return promise;
      }
    };
  },

  async synchronize() {
    for (const { id, name } of config.alexa.devices) {
      let knownDevice = await Device.findByProviderId('alexa', id);

      if (!knownDevice) {
        knownDevice = Device.build({
          provider: 'alexa',
          providerId: id
        });
      }

      knownDevice.manufacturer = 'Amazon';
      knownDevice.model = 'Echo';
      knownDevice.name = name;

      await knownDevice.save();
    }
  }
});

DeviceCapabilityEvents.onButtonPressedChanged(async (event) => {
  const device = await event.getDevice();
  await sendSimpleEventSourceTrigger(String(device.id));
});