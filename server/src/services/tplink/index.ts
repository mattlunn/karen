import { Bulb, Client, Plug } from 'tplink-smarthome-api';
import { Device } from '../../models';
import config from '../../config';
import sleep from '../../helpers/sleep';
import newrelic from 'newrelic';

const client = new Client();

function getTpLinkDeviceFromDevice(device: Device): Promise<Bulb | Plug | null> {
  return Promise.race([
    client.getDevice({ host: device.providerId }),
    sleep(Math.max(config.tplink.connect_timeout_milliseconds, 1)).then(() => null)
  ]).catch(e => {
    newrelic.noticeError(e);

    return null;
  });
}

Device.registerProvider('tplink', {
  getCapabilities() {
    return ['LIGHT']
  },

  getLightCapability(device) {
    return {
      getBrightness() {
        return Promise.resolve(100);
      },

      async getIsOn() {
        return (await getTpLinkDeviceFromDevice(device).then(x => x?.getPowerState())) ?? false;
      },

      setBrightness() {
        throw new Error('TPLink does not allow changing of brightness');
      },

      async setIsOn(isOn: boolean) {
        await getTpLinkDeviceFromDevice(device).then(x => x?.setPowerState(isOn));
      }
    }; 
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