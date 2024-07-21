import { Bulb, Client, Plug } from 'tplink-smarthome-api';
import { Device } from '../../models';
import config from '../../config';
import sleep from '../../helpers/sleep';
import { noticeError } from 'newrelic';

const client = new Client();

function getTpLinkDeviceFromDevice(device: Device): Promise<Bulb | Plug | null> {
  return Promise.race([
    client.getDevice({ host: device.providerId }),
    sleep(Math.max(config.tplink.connect_timeout_milliseconds, 1)).then(() => null)
  ]).catch(e => {
    noticeError(e);
    
    return null;
  });
}

Device.registerProvider('tplink', {
  async setProperty(device, key, value) {
    switch (key) {
      case 'on':
        return getTpLinkDeviceFromDevice(device).then(x => x?.setPowerState(value as boolean));
      default:
        throw new Error(`"${key}" is not a recognised property for tplink`);
    }
  },

  async getProperty(device, key) {
    switch (key) {
      case 'connected':
        return (await getTpLinkDeviceFromDevice(device)) === null;
      case 'brightness':
        return 100;
      case 'on':
        return getTpLinkDeviceFromDevice(device).then(x => x?.getPowerState());
      default:
        throw new Error(`"${key}" is not a recognised property for tplink`);
    }
  },

  async synchronize() {
    const discoveryDuration = Math.max(5, config.tplink.discovery_duration_seconds) * 1000;
    const newDevices: (Bulb | Plug)[] = [];

    client.startDiscovery({
      discoveryTimeout: discoveryDuration
    }).on('device-new', device => {
      newDevices.push(device)
    });
    await sleep(discoveryDuration);

    for (const newDevice of newDevices) {
      let device = await Device.findByProviderId('tplink', newDevice.host);

      if (device === null) {
        device = Device.build({
          provider: 'tplink',
          providerId: newDevice.host
        });
      }

      device.type = 'light';
      device.name = newDevice.alias;

      await device.save();
    }
  }
});