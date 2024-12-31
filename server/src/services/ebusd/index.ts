import { Device, Event } from '../../models';
import config from '../../config';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import EbusClient from './client';

Device.registerProvider('ebusd', {
  async setProperty(device, key, value) {
    switch (key) {
      default:
        throw new Error(`Unable to handle setting '${key}' for ${device.type}`);
    }
  },

  async getProperty(device, key) {
    switch (key) {
      default:
        throw new Error(`Unable to handle retrieving '${key}' for ${device.type}`);
    }
  },

  async synchronize() {
    const device = await Device.findByProviderId('ebusd', 'heatpump');

    if (device === null) {
      await Device.create({
        provider: 'ebusd',
        providerId: 'heatpump',
        name: 'Heat Pump',
        type: 'heatpump'
      });
    }
  }
});

export async function setDHWMode(isOn: true) {
  const client = new EbusClient(config.ebusd.host, config.ebusd.port);
  const device = await Device.findByProviderIdOrError('ebusd', 'heatpump');

  await client.setIsDHWOn(isOn);
}

export async function getDHWMode(): Promise<boolean> {
  const device = await Device.findByProviderIdOrError('ebusd', 'heatpump');
  const latestEvent = await device.getLatestEvent('dhw_mode');

  if (!latestEvent) {
    return true;
  }

  return !latestEvent.end;
}

nowAndSetInterval(createBackgroundTransaction('ebusd:poll', async () => {
  const client = new EbusClient(config.ebusd.host, config.ebusd.port);
  const device = await Device.findByProviderIdOrError('ebusd', 'heatpump');

  async function updateState(device: Device, type: string, currentValuePromise: Promise<number | boolean>, decimalPlaces: number = 1) {
    const timestamp = new Date();
    const lastEvent = await device.getLatestEvent(type);
    const currentValue = await currentValuePromise;
    let valueHasChanged;
    let eventValue;

    if (typeof currentValue === 'number') {
      eventValue = Math.round(currentValue * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces);
      valueHasChanged = !lastEvent || eventValue !== lastEvent.value;
    } else { // currentValue === 'boolean'
      eventValue = Number(currentValue);
      valueHasChanged = !lastEvent || !lastEvent.end !== currentValue
    }

    if (valueHasChanged) {
      // on -> off (update old, don't create new)
      // off -> on (don't touch old, create new)
      // value -> value (update old, create new)

      if (lastEvent && currentValue !== true) {
        lastEvent.end = timestamp;
        await lastEvent.save();
      }

      if (currentValue !== false) {
        await Event.create({
          deviceId: device.id,
          start: timestamp,
          value: eventValue,
          type
        });
      }

      device.onPropertyChanged(type);
    }
  }

  await Promise.all([
    updateState(device, 'outside_temperature', client.getOutsideTemperature()),
    updateState(device, 'actual_flow_temperature', client.getActualFlowTemperature()),
    updateState(device, 'desired_flow_temperature', client.getDesiredFlowTemperature()),
    updateState(device, 'return_temperature', client.getReturnTemperature()),
    updateState(device, 'hwc_temperature', client.getHotWaterCylinderTemperature()),
    updateState(device, 'system_pressure', client.getSystemPressure()),
    updateState(device, 'compressor_power', client.getCompressorPower()),
    updateState(device, 'energy_daily', client.getEnergyDaily()),
    updateState(device, 'current_yield', client.getCurrentYield()),
    updateState(device, 'current_power', client.getCurrentPower()),
    updateState(device, 'mode', client.getMode()),
    updateState(device, 'dhw_mode', client.getDHWIsOn())
  ]);
}), Math.max(config.ebusd.poll_interval_minutes, 1) * 60 * 1000);