import bus, { LAST_USER_LEAVES, FIRST_USER_HOME } from '../bus';
import { Device } from '../models';
import { sendNotification } from '../helpers/notification';
import { joinWithAnd, pluralise } from '../helpers/array';

async function turnOffThermostats() {
  const thermostats = await Device.findByType('thermostat');
  await Promise.all(thermostats.map((thermostat) => thermostat.setProperty('on', false)));
}

async function turnOffLights() {
  const lights = await Device.findByType('light');
  const lightsTurnedOff = [];

  await Promise.all(lights.map(async (light) => {
    if (await light.getProperty('on')) {
      await light.setProperty('on', false);

      lightsTurnedOff.push(light);
    }
  }));

  return lightsTurnedOff;
}

export default function () {
  bus.on(LAST_USER_LEAVES, async () => {
    try {
      const [
        lightsTurnedOff
      ] = await Promise.all([
        turnOffLights(),
        turnOffThermostats()
      ]);

      sendNotification(`No-one is home. The heating has been turned off, as well as ${lightsTurnedOff.length ? `the ${joinWithAnd(lightsTurnedOff.map(x => x.name))} light${pluralise(lightsTurnedOff)}` : `all the lights`}.`);
    } catch (e) {
      console.error(e);

      sendNotification(`No-one is home, but there was a problem turning off the heating or lights; so they may still be on!`);
    }
  });

  bus.on(FIRST_USER_HOME, async () => {
    const thermostats = await Device.findByType('thermostat');

    await Promise.all(thermostats.map(async (thermostat) => {
      thermostat.setProperty('on', true);
    }));
  });
}