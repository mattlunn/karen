import { login } from 'tplink-cloud-api';
import { Device } from '../../models';
import config from '../../config';

function getHandlerForDevice(client, device) {
  switch (device.meta.deviceModel) {
    case 'HS100(UK)':
      return client.getHS100(device.name);
    case 'HS110(UK)':
      return client.getHS110(device.name);
  }

  return null;
}

const authenticatedClient = (function () {
  return login(config.tplink.username, config.tplink.password);
}());

Device.registerProvider('tplink', {
  async setProperty(device, key, value) {
    switch (key) {
      case 'on':
        getHandlerForDevice(await authenticatedClient, device)[value ? 'powerOn' : 'powerOff']().catch(() => {});
        break;
      default:
        throw new Error(`"${key}" is not a recognised property for tplink`);
    }
  },

  async getProperty(device, key) {
    switch (key) {
      case 'connected':
        return getHandlerForDevice(await authenticatedClient, device).getSysInfo().then(() => true, () => false);
      case 'brightness':
        return 100;
      case 'on':
        return getHandlerForDevice(await authenticatedClient, device).isOn().catch(() => false);
      default:
        throw new Error(`"${key}" is not a recognised property for tplink`);
    }
  },

  async synchronize() {
    const client = await authenticatedClient;
    const lights = await client.getDeviceList();

    for (const light of lights) {
      let device = await Device.findByProviderId('tplink', light.deviceId);

      if (device === null) {
        device = Device.build({
          provider: 'tplink',
          providerId: light.deviceId
        });
      }

      device.type = 'light';
      device.name = light.alias;
      device.meta.deviceModel = light.deviceModel;

      await device.save();
    }
  }
});