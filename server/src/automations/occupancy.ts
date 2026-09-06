import { z } from 'zod';
import bus, { LAST_USER_LEAVES, FIRST_USER_HOME, NOTIFICATION_TO_ADMINS } from '../bus';
import { Device, Arming, Stay } from '../models';
import { asyncFilter, joinWithAnd, pluralise } from '../helpers/array';
import { createBackgroundTransaction } from '../helpers/newrelic';
import { ArmingMode } from '../models/arming';

export const parameters = z.object({
  timeout_for_last_user_leaves_tasks_to_execute: z.number().nonnegative()
});

async function turnOffLights() {
  const lights = await Device.findByCapability('LIGHT');
  const turnedOff: Device[] = [];
  const failedToTurnOff: Device[] = [];

  await Promise.all(lights.map(async (light) => {
    if (!await light.getLightCapability().getIsOn()) {
      return;
    }

    try {
      await light.getLightCapability().setIsOn(false);

      turnedOff.push(light);
    } catch {
      failedToTurnOff.push(light);
    }
  }));

  return { turnedOff, failedToTurnOff };
}

async function getOpenContactSensors(): Promise<Device[]> {
  const sensors = await Device.findByCapability('CONTACT_SENSOR');

  return asyncFilter(sensors, sensor => sensor.getContactSensorCapability().getIsOpen());
}

function promiseOrAbort<T>(promise: Promise<T>, abortSignal: AbortSignal): Promise<T> {
  return Promise.race([
    promise,

    new Promise<T>((_, reject) => {
      abortSignal.addEventListener('abort', () => {
        reject(new Error('Operation aborted'));
      });
    })
  ]);
}
 
export default function (config: z.infer<typeof parameters>) {
  bus.on(LAST_USER_LEAVES, createBackgroundTransaction('automations:occupancy:last-user-leaves', async (stay) => {
    const abortController = new AbortController();

    async function ensureActiveArming(): Promise<Arming> {
      const activeArming = await Arming.getActiveArming(stay.end);

      if (activeArming === null) {
        return Arming.create({
          start: stay.departure,
          mode: ArmingMode.AWAY
        });
      }

      return activeArming;
    }

    async function getUnsecuredLocks(): Promise<Device[]> {
      const doors = await Device.findByCapability('LOCK');
      const doorsConfirmedLocked = await Promise.allSettled(doors.map(async (door) => {
        return await door.getLockCapability().ensureIsLocked(abortController.signal);
      }));

      return doors.filter((x, i) => doorsConfirmedLocked[i].status !== 'fulfilled');
    }
  
    async function ensureHeatingOff() {
      const thermostats = await Device.findByCapability('THERMOSTAT');
      const results = await Promise.all(thermostats.map(async (thermostat) => {
        const capability = thermostat.getThermostatCapability();
        const targetTemperature = await capability.getTargetTemperature();

        if (targetTemperature <= 0) {
          return { turnedBack: false, failedToTurnOff: false };
        }

        try {
          await capability.setTargetTemperature(await capability.getSetbackTemperature());

          return { turnedBack: true, failedToTurnOff: false };
        } catch {
          return { turnedBack: false, failedToTurnOff: true };
        }
      }));

      return {
        turnedBack: results.some(x => x.turnedBack),
        failedToTurnOff: results.some(x => x.failedToTurnOff)
      };
    }
    
    try {
      setTimeout(() => {
        abortController.abort();
      }, config.timeout_for_last_user_leaves_tasks_to_execute);

      const [
        activeArming,
        locksUnsecured,
        openContactSensors,
        heating,
        lights
      ] = await Promise.all([
        promiseOrAbort(ensureActiveArming(), abortController.signal),
        promiseOrAbort(getUnsecuredLocks(), abortController.signal),
        promiseOrAbort(getOpenContactSensors(), abortController.signal),
        promiseOrAbort(ensureHeatingOff(), abortController.signal),
        promiseOrAbort(turnOffLights(), abortController.signal)
      ]);

      const houseIsUnsecured = locksUnsecured.length > 0 || openContactSensors.length > 0;
      const somethingCouldntBeTurnedOff = lights.failedToTurnOff.length > 0 || heating.failedToTurnOff;
      const prefix = `${houseIsUnsecured ? '‼️' : ''}${somethingCouldntBeTurnedOff ? '⚠️' : ''}`;

      const lightsStatus = (() => {
        if (lights.failedToTurnOff.length) {
          return `${lights.failedToTurnOff.length} light${pluralise(lights.failedToTurnOff)} could not be turned off,`;
        }

        if (lights.turnedOff.length) {
          return `${joinWithAnd(lights.turnedOff.map(x => x.name))} light${pluralise(lights.turnedOff)} have been turned off,`;
        }

        return `All the lights are off,`;
      })();

      const heatingStatus = heating.failedToTurnOff
        ? 'the heating could not be turned off, and'
        : `the heating ${heating.turnedBack ? 'has been turned off' : 'was already off'}, and`;

      const notification = [
        `${prefix ? `${prefix} ` : ''}No-one is home.`,
        lightsStatus,
        heatingStatus,
        activeArming.mode === ArmingMode.AWAY ? 'the alarm is on.' : 'the alarm is already set to Night Mode.',
        locksUnsecured.length === 0 ? 'All the doors are locked.' : `The ${joinWithAnd(locksUnsecured.map(x => x.name))} ${locksUnsecured.length === 1 ? 'is' : 'are'} not locked!`,
        openContactSensors.length === 0 ? 'All the doors and windows are shut.' : `The ${joinWithAnd(openContactSensors.map(x => x.name))} ${openContactSensors.length === 1 ? 'is' : 'are'} open!`
      ].join(' ');

      bus.emit(NOTIFICATION_TO_ADMINS, {
        message: notification
      });
    } catch (e) {
      bus.emit(NOTIFICATION_TO_ADMINS, {
        message: `‼️⚠️ No-one is home, but there was a problem securing the house, turning off the heating and lights, or turning on the alarm!`
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

    const thermostats = await Device.findByCapability('THERMOSTAT');
    await Promise.all(thermostats.map(async (thermostat) => {
      const targetTemperature = await thermostat.getThermostatCapability().getTargetTemperature();

      if (targetTemperature !== 0) {
        await thermostat.getThermostatCapability().setIsOn(true);
      }
    }));
  }));
}