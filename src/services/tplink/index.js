import { login } from 'tplink-cloud-api';
import config from '../../config';

function getHandlerForDevice(client, device) {
  switch (device.deviceModel) {
    case 'HS100(UK)':
      return client.getHS100(device.alias);
    case 'HS110(UK)':
      return client.getHS110(device.alias);
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

  return await Promise.all(devices.reduce((list, device) => {
    const handler = getHandlerForDevice(client, device);

    if (handler !== null) {
      list.push((async function () {
        return {
          name: device.alias,
          switchIsOn: await handler.isOn(),
          switchFeatureId: device.alias,
          type: 'tplink'
        };
      }()));
    }

    return list;
  }, []));
}