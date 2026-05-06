import bus, { NOTIFICATION_TO_ADMINS } from '../bus';
import { Device } from '../models';
import { createBackgroundTransaction } from '../helpers/newrelic';
import { DeviceCapabilityEvents } from '../models/capabilities';
import { asyncFilterAndMap } from '../helpers/array';

type HeatingAutomationParameters = {
  heatingSwitchName: string;
  temperatureDeltaSwitchOnThreshold: number;
};

export default function ({ heatingSwitchName, temperatureDeltaSwitchOnThreshold }: HeatingAutomationParameters) {
  async function evaluateTurnOn(triggeringDevice: Device) {
    if (await triggeringDevice.getThermostatCapability().getIsPassive()) {
      return;
    }

    const target = await triggeringDevice.getThermostatCapability().getTargetTemperature();
    const current = await triggeringDevice.getThermostatCapability().getCurrentTemperature();
    const delta = target - current;

    if (delta <= temperatureDeltaSwitchOnThreshold) {
      return;
    }

    const heatingDevice = await Device.findByNameOrError(heatingSwitchName);

    if (await heatingDevice.getSwitchCapability().getIsOn()) {
      return;
    }

    await heatingDevice.getSwitchCapability().setIsOn(true);

    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: `Turning heating on, as ${triggeringDevice.name} is ${delta.toFixed(1)}° below target of ${target}°C`
    });
  }

  async function evaluateTurnOff() {
    const heatingDevice = await Device.findByNameOrError(heatingSwitchName);

    if (!await heatingDevice.getSwitchCapability().getIsOn()) {
      return;
    }

    const [thermostats, heatPumps] = await Promise.all([
      Device.findByCapability('THERMOSTAT'),
      Device.findByCapability('HEAT_PUMP')
    ]);

    if (heatPumps.length === 0) {
      throw new Error('Heating automation: expected at least one HEAT_PUMP device, but none were found');
    }

    const compressorModulation = await heatPumps[0].getHeatPumpCapability().getCompressorModulation();

    if (compressorModulation !== 0) {
      return;
    }

    const nonPassivePowers = await asyncFilterAndMap(
      thermostats,
      async t => !await t.getThermostatCapability().getIsPassive(),
      t => t.getThermostatCapability().getPower()
    );

    if (!nonPassivePowers.every(p => p === 0)) {
      return;
    }

    await heatingDevice.getSwitchCapability().setIsOn(false);

    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: 'Turning heating off, as heat pump has modulated to 0 and no thermostats are requesting heat'
    });
  }

  DeviceCapabilityEvents.onThermostatCurrentTemperatureChanged(createBackgroundTransaction('automations:heating:thermostat-current-temperature-changed', async (event) => {
    await evaluateTurnOn(await event.getDevice());
  }));

  DeviceCapabilityEvents.onThermostatTargetTemperatureChanged(createBackgroundTransaction('automations:heating:thermostat-target-temperature-changed', async (event) => {
    await evaluateTurnOn(await event.getDevice());
  }));

  DeviceCapabilityEvents.onThermostatPowerChanged(createBackgroundTransaction('automations:heating:thermostat-power-changed', async () => {
    await evaluateTurnOff();
  }));

  DeviceCapabilityEvents.onHeatPumpCompressorModulationChanged(createBackgroundTransaction('automations:heating:heat-pump-compressor-modulation-changed', async () => {
    await evaluateTurnOff();
  }));
}
