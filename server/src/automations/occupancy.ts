import bus, { LAST_USER_LEAVES, FIRST_USER_HOME, NOTIFICATION_TO_ADMINS } from '../bus';
import { Device, Arming, Stay } from '../models';
import { joinWithAnd, pluralise } from '../helpers/array';
import { createBackgroundTransaction } from '../helpers/newrelic';
import { getCentralHeatingMode, setCentralHeatingMode } from '../services/tado';
import { ArmingMode } from '../models/arming';

async function turnOffLights() {
  const lights = await Device.findByType('light');
  const lightsTurnedOff: Device[] = [];

  await Promise.all(lights.map(async (light) => {
    if (await light.getLightCapability().getIsOn()) {
      await light.getLightCapability().setIsOn(false);

      lightsTurnedOff.push(light);
    }
  }));

  return lightsTurnedOff;
}

export default function () {
  bus.on(LAST_USER_LEAVES, createBackgroundTransaction('automations:occupancy:last-user-leaves', async (stay) => {
    async function ensureActiveArming(): Promise<Arming> {
      let activeArming = await Arming.getActiveArming(stay.end);

      if (activeArming === null) {
        return Arming.create({
          start: stay.departure,
          mode: ArmingMode.AWAY
        });
      }

      return activeArming;
    }
  
    async function ensureHeatingOff() {
      const currentHeatingMode = await getCentralHeatingMode();

      if (currentHeatingMode === 'ON') {
        await setCentralHeatingMode('SETBACK');

        return true;
      }

      return false;
    }
    
    try {
      let [
        activeArming,
        centralHeatingModeChanged,
        lightsTurnedOff
      ] = await Promise.all([
        ensureActiveArming(),
        ensureHeatingOff(),
        turnOffLights()
      ]);

      const notification = [
        `No-one is home.`,
        lightsTurnedOff.length ? `${joinWithAnd(lightsTurnedOff.map(x => x.name))} light${pluralise(lightsTurnedOff)} have been turned off,` : `All the lights are off,`,
        `the heating ${centralHeatingModeChanged ? 'has been turned off' : 'was already off'}, and`,
        activeArming.mode === ArmingMode.AWAY ? 'the alarm is on.' : 'the alarm is already set to Night Mode.'
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
    const activeArming = await Arming.getActiveArming(stay.arrival!);

    if (activeArming?.mode === ArmingMode.AWAY) {
      activeArming.end = stay.arrival;
      await activeArming.save();
    }

    await setCentralHeatingMode('ON');
  }));
}