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
      case 'connected':
        return true;
      case 'target':
      case 'temperature':
      case 'humidity':
      case 'power':
        return (await device.getLatestEvent(key)).value;
      case 'heating': {
        const latestEvent = await device.getLatestEvent(key);
        return !!latestEvent && !latestEvent.end;
      }
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

nowAndSetInterval(createBackgroundTransaction('ebusd:poll', async () => {
  const client = new EbusClient(config.ebusd.host, config.ebusd.port);
  const device = await Device.findByProviderIdOrError('ebusd', 'heatpump');

  async function updateState(device: Device, type: string, currentValue: number | boolean, decimalPlaces: number = 1) {
    const timestamp = new Date();
    const lastEvent = await device.getLatestEvent(type);
    let valueHasChanged;
    let eventValue;

    if (typeof currentValue === 'number') {
      eventValue = Math.round(currentValue * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces);
      valueHasChanged = eventValue !== lastEvent.value;
    } else { // currentValue === 'boolean'
      eventValue = Number(currentValue);
      valueHasChanged = !lastEvent.end !== currentValue
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

  await updateState(device, 'outside_temperature', await client.getOutsideTemperature());
  await updateState(device, 'actual_flow_temperature', await client.getActualFlowTemperature());
  await updateState(device, 'desired_flow_temperature', await client.getDesiredFlowTemperature());
  await updateState(device, 'system_pressure', await client.getSystemPressure());
  await updateState(device, 'compressor_power', await client.getCompressorPower());
  await updateState(device, 'is_active', await client.getIsActive());
}), Math.max(config.ebusd.poll_interval_minutes, 1) * 60 * 1000);