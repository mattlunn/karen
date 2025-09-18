import bus, { NOTIFICATION_TO_ADMINS } from '../bus';
import { Device } from '../models';
import { createBackgroundTransaction } from '../helpers/newrelic';
import { DeviceCapabilityEvents } from '../models/capabilities';

type HeatingAutomationParameters = {
  heatingSwitchName: string;
  temperatureDeltaSwitchOnThreshold: number;
  temperatureDeltaSwitchOffThreshold: number;
  heatPumpDeviceName: string;
  compressorCooldownPeriodInMinutes: number;
};

let compressorLockedOutForCooldown = false;

export default function ({ heatingSwitchName, temperatureDeltaSwitchOffThreshold, temperatureDeltaSwitchOnThreshold, heatPumpDeviceName, compressorCooldownPeriodInMinutes }: HeatingAutomationParameters) {
  function lockoutCompressor() {
    compressorLockedOutForCooldown = true;

    setTimeout(async () => {
      if (compressorLockedOutForCooldown === true) {
        const heatingDevice = await Device.findByNameOrError(heatingSwitchName);
        const thermostats = await Device.findByType('thermostat');
        const thermostatsHeatDemand = await Promise.all(thermostats.map((thermostat) => thermostat.getThermostatCapability().getIsOn()));
        const thermostatsAreRequestingHeat = thermostatsHeatDemand.some(x => x);

        compressorLockedOutForCooldown = false;

        if (thermostatsAreRequestingHeat) {
          await heatingDevice.getSwitchCapability().setIsOn(true);
        }

        bus.emit(NOTIFICATION_TO_ADMINS, {
          message: `Heat pump lockout ended.${thermostatsAreRequestingHeat ? ' Turning heating on as thermostats are requesting heat' : ''}`
        });
      }
    }, compressorCooldownPeriodInMinutes * 60 * 1000);
  }

  /**
   * @returns < 0 === How many degrees below target temperature. > 0 === How many degrees above target temperature
   */
  async function getLargestTemperatureDelta() {
    const thermostats = await Device.findByType('thermostat');
    const temperatureDeltas = await Promise.all(thermostats.map(async (thermostat) => {
      return await thermostat.getThermostatCapability().getCurrentTemperature() - await thermostat.getThermostatCapability().getTargetTemperature();
    }));
    
    return Math.min(...temperatureDeltas);
  }

  DeviceCapabilityEvents.onThermostatPowerChanged(createBackgroundTransaction('automations:heating:thermostat-power-changed', async (event) => {
    const thermostat = await event.getDevice();
    const heatingDevice = await Device.findByNameOrError(heatingSwitchName);
    const heatingIsOn = await heatingDevice.getSwitchCapability().getIsOn();
    const thermostatIsOn = event.value > 0;

    // On power change, if any heating demand, then turn on.
    if (thermostatIsOn) {
      if (!heatingIsOn && !compressorLockedOutForCooldown) {
        await heatingDevice.getSwitchCapability().setIsOn(true);

        bus.emit(NOTIFICATION_TO_ADMINS, {
          message: `Turning heating on, as ${thermostat.name} is requesting heat (${event.value}%)`
        });
      }

    // On power change to 0, if no thermostats within X degrees, then turn off
    } else {
      const maximumTemperatureDelta = await getLargestTemperatureDelta();

      if (maximumTemperatureDelta > temperatureDeltaSwitchOffThreshold && heatingIsOn) {
        await heatingDevice.getSwitchCapability().setIsOn(false);

        bus.emit(NOTIFICATION_TO_ADMINS, { 
          message: `Turning heating off, as no thermostats are within ${temperatureDeltaSwitchOffThreshold}° of their target temperature`
        });
      }
    }
  }));

  DeviceCapabilityEvents.onThermostatCurrentTemperatureChanged(createBackgroundTransaction('automations:heating:thermostat-temperature-changed', async (event) => {
    const heatingDevice = await Device.findByNameOrError(heatingSwitchName);
    const thermostat = await event.getDevice();
    const target = await thermostat.getThermostatCapability().getTargetTemperature(); 
    const temperatureDelta = target - event.value;

    if (temperatureDelta > temperatureDeltaSwitchOnThreshold && compressorLockedOutForCooldown) {
      await heatingDevice.getSwitchCapability().setIsOn(true);

      compressorLockedOutForCooldown = false;

      bus.emit(NOTIFICATION_TO_ADMINS, { 
        message: `Ending lockout and turning heating on, as ${thermostat.name} is ${temperatureDelta}° below target of ${target}°C`
      });
    }
  }));

  DeviceCapabilityEvents.onHeatPumpCompressorModulationChanged(createBackgroundTransaction('automations:heating:compressor-modulation-changed', async (event) => {
    const heatingDevice = await Device.findByNameOrError(heatingSwitchName);
    const heatingIsOn = await heatingDevice.getSwitchCapability().getIsOn();

    // Either because we have already turned heat demand off from above, or there is not enough heat demand to keep
    // the heat pump on, so turn it off.
    if (event.value === 0 && heatingIsOn) {
      const maximumTemperatureDelta = await getLargestTemperatureDelta();

      // ... but only if all rooms are warm enough, otherwise the above condition will just switch the heating on again.
      if (maximumTemperatureDelta > temperatureDeltaSwitchOnThreshold) {
        await heatingDevice.getSwitchCapability().setIsOn(false);
        
        lockoutCompressor();

        bus.emit(NOTIFICATION_TO_ADMINS, {
          message: `Turning heating off, and locking out for max ${compressorCooldownPeriodInMinutes} minutes as heat pump compressor has modulated down to 0`
        });
      }
    }
  }));
}