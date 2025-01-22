import bus, { EVENT_START, NOTIFICATION_TO_ADMINS } from '../bus';
import { Device, Event } from '../models';
import { createBackgroundTransaction } from '../helpers/newrelic';

type HeatingAutomationParameters = {
  heatingSwitchName: string;
  temperatureDeltaSwitchoffThreshold: number;
  heatPumpDeviceName: string;
  compressorCooldownPeriodInMinutes: number;
};

let compressorLockedOutForCooldown = false;

export default function ({ heatingSwitchName, temperatureDeltaSwitchoffThreshold, heatPumpDeviceName, compressorCooldownPeriodInMinutes }: HeatingAutomationParameters) {
  function lockoutCompressor() {
    compressorLockedOutForCooldown = true;

    setTimeout(async () => {
      const heatingDevice = await Device.findByNameOrError(heatingSwitchName);
      const thermostats = await Device.findByType('thermostat');
      const thermostatsHeatDemand = await Promise.all(thermostats.map((thermostat) => thermostat.getThermostatCapability().getIsHeating()));
      const thermostatsAreRequestingHeat = thermostatsHeatDemand.some(x => x);

      compressorLockedOutForCooldown = false;

      if (thermostatsAreRequestingHeat) {
        await heatingDevice.getSwitchCapability().setIsOn(true);
      }

      bus.emit(NOTIFICATION_TO_ADMINS, {
        message: `Heat pump lockout ended.${thermostatsAreRequestingHeat ? ' Turning heating on as thermostats are requesting heat' : ''}`
      });
    }, compressorCooldownPeriodInMinutes * 60 * 1000);
  }

  bus.on(EVENT_START, createBackgroundTransaction(`automations:heating`, async (event: Event) => {
    const eventDevice = await event.getDevice();
    const heatingDevice = await Device.findByNameOrError(heatingSwitchName);
    const heatingIsOn = await heatingDevice.getSwitchCapability().getIsOn();

    if (eventDevice.hasCapability('THERMOSTAT') && event.type === 'power') {
      const thermostatIsOn = event.value > 0;

      // On power change, if any heating demand, then turn on.
      if (thermostatIsOn) {
        if (!heatingIsOn && !compressorLockedOutForCooldown) {
          await heatingDevice.getSwitchCapability().setIsOn(true);

          bus.emit(NOTIFICATION_TO_ADMINS, {
            message: `Turning heating on, as ${eventDevice.name} is requesting heat (${event.value}%)`
          });
        }

      // On power change to 0, if no thermostats within X degrees, then turn off
      } else {
        const thermostats = await Device.findByType('thermostat');
        const temperatureDeltas = await Promise.all(thermostats.map(async (thermostat) => {
          return await thermostat.getThermostatCapability().getTargetTemperature() - await thermostat.getThermostatCapability().getCurrentTemperature();
        }));
        
        const maximumTemperatureDelta = Math.min(...temperatureDeltas);

        if (maximumTemperatureDelta > temperatureDeltaSwitchoffThreshold && heatingIsOn) {
          await heatingDevice.getSwitchCapability().setIsOn(false);

          bus.emit(NOTIFICATION_TO_ADMINS, { 
            message: `Turning heating off, as no thermostats are within ${temperatureDeltaSwitchoffThreshold}° of their target temperature`
          });
        }
      }
    }

    if (eventDevice.name === heatPumpDeviceName && event.type === 'compressor_modulation') {
      if (event.value === 0 && heatingIsOn) {
        // Either because we have already turned heat demand off from above, or there is not enough heat demand to keep
        // the heat pump on, so turn it off.
        await heatingDevice.getSwitchCapability().setIsOn(false);
        
        lockoutCompressor();

        bus.emit(NOTIFICATION_TO_ADMINS, {
          message: `Turning heating off, and locking out for ${compressorCooldownPeriodInMinutes} minutes as heat pump compressor has modulated down to 0`
        });
      }
    }
  }));
}