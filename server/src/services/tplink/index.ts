import { Bulb, Client, Plug } from 'tplink-smarthome-api';
import { Device } from '../../models';
import config from '../../config';
import sleep from '../../helpers/sleep';
import newrelic from 'newrelic';
import logger from '../../logger';
import nowAndSetCron from '../../helpers/now-and-set-cron';

const client = new Client();

function getTpLinkDeviceFromDevice(device: Device): Promise<Plug | Bulb | null> {
  return Promise.race([
    client.getDevice({ host: device.providerId }),
    sleep(Math.max(config.tplink.connect_timeout_milliseconds, 1)).then(() => null)
  ]).catch(e => {
    // A powered-off plug has no route on the network; the caller already
    // reflects that via setIsConnectedState(false), so it isn't worth noticing.
    if ((e as NodeJS.ErrnoException)?.code !== 'EHOSTUNREACH') {
      newrelic.noticeError(e);
    }

    return null;
  });
}

nowAndSetCron(async () => {
  const devices = await Device.findByProvider('tplink');

  for (const device of devices) {
    const tpLinkDevice = await getTpLinkDeviceFromDevice(device) as Plug | null;

    if (tpLinkDevice === null) {
      await device.getConnectivityCapability().setIsConnectedState(false);
      continue;
    }

    await device.getLightCapability().setIsOnState(await tpLinkDevice.getPowerState());
    await device.getConnectivityCapability().setIsConnectedState(true);
  }
}, config.tplink.sync_cron);

Device.registerProvider('tplink', {
  getCapabilities() {
    return ['LIGHT', 'CONNECTIVITY'];
  },

  provideLightCapability() {
    return {
      setBrightness(device: Device) {
        throw new Error('TPLink does not allow changing of brightness');
      },

      async setIsOn(device: Device, isOn: boolean) {
        const tpLinkDevice = await getTpLinkDeviceFromDevice(device);

        if (tpLinkDevice) {
          await tpLinkDevice.setPowerState(isOn);
          await device.getLightCapability().setIsOnState(isOn);
        }
      }
    };
  },

  async synchronize() {
    const devices = await Device.findByProvider('tplink');

    for (const device of devices) {
      const tpLinkDevice = await getTpLinkDeviceFromDevice(device);

      if (tpLinkDevice === null) {
        logger.info(`TPLink device ${device.id} (${device.providerId}) is unreachable; not synchronizing it`);
        continue;
      }

      device.manufacturer = 'TP-Link';
      device.model = tpLinkDevice.model;
      device.name = tpLinkDevice.alias;

      await device.save();
    }
  }
});