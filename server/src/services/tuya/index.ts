import TuyaDevice from 'tuyapi';
import { Device } from '../../models';
import config from '../../config';
import sleep from '../../helpers/sleep';
import logger from '../../logger';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';

// DP 1 ("switch") is the built-in heater, confirmed live against the real
// device on 2026-08-23. DP 10 ("light") is the flame-effect light, which
// toggles independently of the heater - that's the one being exposed here.
const SWITCH_DPS = 10;

function configFor(device: Device) {
  const entry = config.tuya.devices.find(e => e.id === device.providerId);

  if (!entry) {
    throw new Error(`No tuya config entry for device ${device.providerId}`);
  }

  return entry;
}

async function withConnection<T>(device: Device, fn: (client: TuyaDevice) => Promise<T>): Promise<T> {
  const entry = configFor(device);
  const client = new TuyaDevice({
    id: entry.id,
    key: entry.key,
    ip: entry.ip,
    version: entry.version,
  });

  await Promise.race([
    client.connect(),
    sleep(config.tuya.connect_timeout_milliseconds).then(() => {
      throw new Error(`Timed out connecting to tuya device ${device.providerId}`);
    })
  ]);

  try {
    return await fn(client);
  } finally {
    client.disconnect();
  }
}

Device.registerProvider('tuya', {
  getCapabilities() {
    return ['SWITCH', 'CONNECTIVITY'];
  },

  provideSwitchCapability() {
    return {
      async setIsOn(device: Device, isOn: boolean) {
        await withConnection(device, client => client.set({ dps: SWITCH_DPS, set: isOn }));
      },
    };
  },

  async synchronize() {
    for (const entry of config.tuya.devices) {
      let device = await Device.findByProviderId('tuya', entry.id);

      if (device === null) {
        device = Device.build({
          provider: 'tuya',
          providerId: entry.id,
          name: entry.name,
          manufacturer: 'Tuya',
          model: 'Onyx Avanti',
        });
      }

      await device.save();
    }
  }
});

nowAndSetInterval(createBackgroundTransaction('tuya:poll', async () => {
  const devices = await Device.findByProvider('tuya');

  await Promise.all(devices.map(async device => {
    try {
      const isOn = await withConnection(device, client => client.get({ dps: SWITCH_DPS })) as boolean;

      await device.getSwitchCapability().setIsOnState(isOn);
      await device.getConnectivityCapability().setIsConnectedState(true);
    } catch (e) {
      // A poll failure while the device is off/unreachable is expected, not
      // exceptional, so don't rethrow and crash the poll loop - but log it
      // so the actual connectivity failure reason is visible.
      logger.error(e, `Failed to poll tuya device ${device.providerId}`);

      await device.getConnectivityCapability().setIsConnectedState(false);
    }
  }));
}), Math.max(config.tuya.poll_interval_seconds, 5) * 1000);
