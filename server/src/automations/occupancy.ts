import bus, { LAST_USER_LEAVES, FIRST_USER_HOME, NOTIFICATION_TO_ADMINS } from '../bus';
import { Device, Arming, Stay } from '../models';
import { joinWithAnd, pluralise } from '../helpers/array';
import { createBackgroundTransaction } from '../helpers/newrelic';

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
  const lightsTurnedOff: Device[] = [];

  await Promise.all(lights.map(async (light) => {
    if (await light.getProperty('on')) {
      await light.setProperty('on', false);

      lightsTurnedOff.push(light);
    }
  }));

  return lightsTurnedOff;
}

export default function () {
  bus.on(LAST_USER_LEAVES, createBackgroundTransaction('automations:occupancy:last-user-leaves', async (stay) => {
    try {
      let [
        activeArming,
        lightsTurnedOff,
      ] = await Promise.all([
        Arming.getActiveArming(stay.end),
        turnOffLights(),
        turnOffThermostats()
      ]);

      if (!activeArming) {
        activeArming = await Arming.create({
          start: stay.departure,
          mode: Arming.MODE_AWAY
        });
      }

      const notification = [
        `No-one is home.`,
        `The heating has been turned off, as well as ${lightsTurnedOff.length ? `the ${joinWithAnd(lightsTurnedOff.map(x => x.name))} light${pluralise(lightsTurnedOff)}` : `all the lights`}.`,
        activeArming.mode === Arming.MODE_AWAY ? 'The alarm is also on' : 'The alarm is on, but in Night Mode'
      ].join(' ');

      bus.emit(NOTIFICATION_TO_ADMINS, {
        message: notification
      });
    } catch (e) {
      bus.emit(NOTIFICATION_TO_ADMINS, {
        message: `No-one is home, but there was a problem turning off the heating and lights, or turning on the alarm!`
      });

      throw e;
    }
  }));

  bus.on(FIRST_USER_HOME, createBackgroundTransaction('automations:occupancy:first-user-home', async (stay: Stay) => {
    const activeArming = await Arming.getActiveArming(stay.arrival);

    if (activeArming?.mode === Arming.MODE_AWAY) {
      activeArming.end = stay.arrival;
      await activeArming.save();
    }

    await turnOnThermostats();
  }));
}