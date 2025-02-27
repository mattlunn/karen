import bus, { FIRST_USER_HOME, EVENT_START } from '../bus';
import { Device } from '../models';
import { startBackgroundTransaction } from '../helpers/newrelic';

const greetings: ((name: string) => string)[] = [
  (name) => `<voice name="Mizuki"><lang xml:lang="ja-JP">こんにちは ${name}</lang></voice>. That's hello, in Japanese!'`,
  (name) => `<voice name="Nicole"><lang xml:lang="en-AU">G'day ${name}. Pop a shrimp on the barbi and lets crack open a Fosters</lang></voice>. That's how Australians say Hello!`,
  (name) => `<voice name="Marlene"><lang xml:lang="de-DE">Hallo ${name}</lang></voice>. That's how ze Germans say hello!`,
  (name) => `<voice name="Carla"><lang xml:lang="it-IT">Ciao ${name}</lang></voice>. That's how Italian's say hi!`,
  (name) => `<voice name="Camila"><lang xml:lang="pt-BR">Olá ${name}</lang></voice>. That's how the Portugese say hi!`,
  (name) => `<voice name="Lucia"><lang xml:lang="es-ES">Hola ${name}</lang></voice>. That's how the Spanish say hi!`,
  (name) => `<voice name="Geraint"><amazon:emotion name="excited" intensity="high">Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch ${name}</amazon:emotion></voice>. That's G, saying hello!`
];

export default async function ({ alexa_name: alexaName }: { alexa_name: string }) {
  bus.on(FIRST_USER_HOME, (stay) => {
    bus.on(EVENT_START, function listener(event) {
      return startBackgroundTransaction('automations:greeting', async function() {
        if (event.type === 'motion') {
          const [
            device,
            user
          ] = await Promise.all([
            Device.findByNameOrError(alexaName),
            stay.getUser()
          ]);

          bus.off(EVENT_START, listener);
          device.getSpeakerCapability().emitSound(greetings[Math.floor(Math.random() * greetings.length)](user.handle));
        }
      });
    });
  });
}