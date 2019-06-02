import { login } from 'tplink-cloud-api';
import { Device } from '../../models';
import config from '../../config';
import bus, * as events from '../../bus';

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

export async function turnLightOnOrOff(alias, isOn) {
  const client = await authenticatedClient;
  const devices = await client.getDeviceList();
  const device = devices.find(x => x.alias === alias);

  if (typeof device !== 'undefined') {
    const handler = getHandlerForDevice(client, device);

    if (handler !== null) {
      if (isOn) {
        return await handler.powerOn();
      } else {
        return await handler.powerOff();
      }
    }
  }

  throw new Error(`Unable to handle device ${alias}`);
}

export async function getLightsAndStatus() {
  const client = await authenticatedClient;
  const devices = await client.getDeviceList();

  return (await Promise.all(devices.reduce((list, device) => {
    const handler = getHandlerForDevice(client, device);

    if (handler !== null) {
      list.push((async function () {
        return {
          name: device.alias,
          isOn: await handler.isOn(),
          id: device.alias,
          provider: 'tplink'
        };
      }()).catch((err) => null));
    }

    return list;
  }, []))).filter(x => x);
}

bus.on(events.LAST_USER_LEAVES, async () => {
  const devices = await getLightsAndStatus();
  const onDevices = devices.filter(device => device.switchIsOn);

  for (const device of onDevices) {
    console.log(`Turning ${device.name} off, as no-one is at home, and it has been left on!`);

    turnLightOnOrOff(device.switchFeatureId, false);
  }
});

Device.registerProvider('tplink', {
  async setProperty(device, key, value) {
    switch (key) {
      case 'on':
        return getHandlerForDevice(await authenticatedClient, device)[value ? 'powerOn' : 'powerOff']();
      default:
        throw new Error(`"${key}" is not a recognised property for tplink`);
    }
  },

  async getProperty(device, key) {
    switch (key) {
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