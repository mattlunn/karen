import bus, { LAST_USER_LEAVES, FIRST_USER_HOME } from '../bus';
import { Device, Arming } from '../models';
import { sendNotification } from '../helpers/notification';
import { joinWithAnd, pluralise } from '../helpers/array';

async function turnOffThermostats() {
  const thermostats = await Device.findByType('thermostat');
  await Promise.all(thermostats.map((thermostat) => thermostat.setProperty('on', false)));
}

async function turnOnThermostats() {
  const thermostats = await Device.findByType('thermostat');

  await Promise.all(thermostats.map(async (thermostat) => {
    thermostat.setProperty('on', true);
  }));
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
  bus.on(LAST_USER_LEAVES, async (stay) => {
    try {
      const [
        activeArming,
        lightsTurnedOff,
      ] = await Promise.all([
        Arming.getActiveArming(stay.end),
        turnOffLights(),
        turnOffThermostats()
      ]);

      if (!activeArming) {
        await Arming.create({
          start: stay.end,
          mode: Arming.MODE_AWAY
        });
      }

      sendNotification(`No-one is home. The heating has been turned off, as well as ${lightsTurnedOff.length ? `the ${joinWithAnd(lightsTurnedOff.map(x => x.name))} light${pluralise(lightsTurnedOff)}` : `all the lights`}.${activeArming ? '' : ' The alarm was also turned on.'}`);
    } catch (e) {
      console.error(e);

      sendNotification(`No-one is home, but there was a problem turning off the heating and lights, or turning on the alarm!`);
    }
  });

  bus.on(FIRST_USER_HOME, async (stay) => {
    const activeArming = await Arming.getActiveArming(stay.start);

    if (activeArming?.mode === Arming.MODE_AWAY) {
      activeArming.end = stay.start;
      await activeArming.save();
    }

    turnOnThermostats();
  });
}