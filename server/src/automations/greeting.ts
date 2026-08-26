import bus, { FIRST_USER_HOME } from '../bus';
import { Device, Stay } from '../models';
import { createBackgroundTransaction } from '../helpers/newrelic';
import { DeviceCapabilityEvents } from '../models/capabilities';
import logger from '../logger';

const greetings: ((name: string) => string)[] = [
  (name) => `<voice name="Mizuki"><lang xml:lang="ja-JP">こんにちは ${name}</lang></voice>. That's hello, in Japanese!'`,
  (name) => `<voice name="Nicole"><lang xml:lang="en-AU">G'day ${name}. Pop a shrimp on the barbi and lets crack open a Fosters</lang></voice>. That's how Australians say Hello!`,
  (name) => `<voice name="Marlene"><lang xml:lang="de-DE">Hallo ${name}</lang></voice>. That's how ze Germans say hello!`,
  (name) => `<voice name="Carla"><lang xml:lang="it-IT">Ciao ${name}</lang></voice>. That's how Italian's say hi!`,
  (name) => `<voice name="Camila"><lang xml:lang="pt-BR">Olá ${name}</lang></voice>. That's how the Portugese say hi!`,
  (name) => `<voice name="Lucia"><lang xml:lang="es-ES">Hola ${name}</lang></voice>. That's how the Spanish say hi!`,
  // amazon:emotion cannot be applied to a <voice>, so the two tags cover separate phrases here.
  (name) => `<voice name="Geraint">Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch ${name}</voice>. <amazon:emotion name="excited" intensity="high">That's G, saying hello!</amazon:emotion>`
];

type GreetingAutomationParameters = {
  alexa_name: string;
  greeting_window_minutes?: number;
};

export default async function ({
  alexa_name: alexaName,
  greeting_window_minutes: greetingWindowMinutes = 10,
}: GreetingAutomationParameters) {
  let unannouncedStay: Stay | null = null;

  DeviceCapabilityEvents.onMotionSensorHasMotionStart(createBackgroundTransaction('automations:greeting', async (event) => {
    if (unannouncedStay !== null) {
      const stay = unannouncedStay;
      unannouncedStay = null;

      const millisecondsSinceArrival = event.start.getTime() - stay.arrival!.getTime();
      if (millisecondsSinceArrival > greetingWindowMinutes * 60 * 1000) {
        logger.info(`Suppressing greeting for stay ${stay.id}: first motion at ${event.start.toISOString()} was ${Math.round(millisecondsSinceArrival / 1000 / 60)} minutes after arrival at ${stay.arrival!.toISOString()}, outside ${greetingWindowMinutes} minute window`);
        return;
      }

      const [device, user] = await Promise.all([
        Device.findByNameOrError(alexaName),
        stay.getUser()
      ]);

      // emitSound only settles once Alexa collects the message, so this has to be awaited — left
      // floating, a failure to speak surfaces as a bare unhandled rejection with no context.
      try {
        await device.getSpeakerCapability().emitSound(greetings[Math.floor(Math.random() * greetings.length)](user.handle));
      } catch (e) {
        logger.error({ err: e, stayId: stay.id, device: device.name }, 'Failed to speak the greeting');
      }
    }
  }));

  bus.on(FIRST_USER_HOME, (stay) => {
    unannouncedStay = stay;
  });
}