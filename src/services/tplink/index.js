import { login } from 'tplink-cloud-api';
import config from '../../config';
import bus, * as events from '../../bus';

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