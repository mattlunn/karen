import config from '../../config';
import { saveConfig } from '../../helpers/config';
import fetch from 'node-fetch';
import { stringify } from 'querystring';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import SmartThingsApiClient from './lib/client';
import { Device } from '../../models';

const deviceTypeMappings = new Map([
  ['Fibaro Dimmer 2 ZW5', 'light'],
  ['SmartSense Motion Sensor', 'motion_sensor']
]);

let accessTokenPromise;

function getAccessToken() {
  return accessTokenPromise;
}

nowAndSetInterval(() => {
  accessTokenPromise = new Promise(async (res) => {
    // {"access_token":"583a45c7-d64c-45b1-a70b-b7de4de5c26d","token_type":"bearer","refresh_token":"f23a5350-16b4-4e1a-b39c-c05898856f3d","expires_in":86399,"scope":"r:locations:* x:devices:* i:deviceprofiles r:devices:* w:devices:*","installed_app_id":"14082a1f-8070-4796-be37-14939e34f938"}
    const response = await fetch('https://auth-global.api.smartthings.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': `Basic ${Buffer.from(config.smartthings.client_id + ':' + config.smartthings.client_secret).toString('base64')}`
      },
      body: stringify({
        grant_type: 'refresh_token',
        client_id: config.smartthings.client_id,
        client_secret: config.smartthings.client_secret,
        refresh_token: config.smartthings.refresh_token
      })
    });

    if (response.ok) {
      const { refresh_token, access_token } = await response.json();

      console.log(`Rotating SmartThings refresh token from ${config.smartthings.refresh_token} to ${refresh_token}`);

      if (process.env.NODE_ENV === 'development') {
        console.log(`SmartThings access token is '${access_token}'`);
      }

      config.smartthings.refresh_token = refresh_token;
      res(access_token);
      saveConfig();
    } else {
      const message = await response.text();

      throw new Error(response.status + ': ' + message);
    }
  });
}, 1000 * 60 * 60);

Device.registerProvider('smartthings', {
  async setProperty(device, key, value) {
    const client = new SmartThingsApiClient(await getAccessToken());

    switch (key) {
      case 'on':
        return client.issueCommand(device.providerId, {
          component: 'main',
          capability: 'switch',
          command: value ? 'on' : 'off'
        });
      default:
        throw new Error(`"${key}" is not a recognised property for SmartThings`);
    }
  },

  async getProperty(device, key) {
    switch (key) {
      case 'on': {
        const latestEvent = await device.getLatestEvent('on');

        return !!(latestEvent && !latestEvent.end);
      }
      default:
        throw new Error(`"${key}" is not a recognised property for SmartThings`);
    }
  },

  async synchronize() {
    const client = new SmartThingsApiClient(await getAccessToken());
    const { items: installedApps } = await client.getInstalledApps();
    const installedAppId = installedApps.find(app => app.appId === config.smartthings.app_id).installedAppId;

    console.log(`SmartThings Installed App Id is ${installedAppId}`);

    const [
      { items: devices },
      { items: subscriptions }
    ] = await Promise.all([
      client.getDevices(),
      client.getSubscriptions(installedAppId)
    ]);

    await Promise.all(devices.filter(device => !subscriptions.some(subscription => subscription.sourceType === "DEVICE" && subscription.device.deviceId === device.deviceId)).map(device => client.createSubscription(installedAppId, {
      sourceType: 'DEVICE',
      device: {
        deviceId: device.deviceId
      }
    })));

    /*
      {
        deviceId: '331901a9-941b-41a2-8319-cbac91295fa2',
        name: 'Fibaro Dimmer 2 ZW5',
        label: 'Dining Room',
        deviceManufacturerCode: '010F-0102-1000',
        locationId: 'cdd47f4c-74d5-4cdf-a490-8264bbd7f1e9',
        roomId: '2f554691-97b5-49fa-93fe-8c7f3f884731',
        deviceTypeId: '7331de54-dd07-4ce1-9cde-f733a56265ce',
        deviceTypeName: 'Fibaro Dimmer 2 ZW5',
        deviceNetworkType: 'ZWAVE'
        ...
      }
    */
    for (const { deviceTypeName, deviceId, label } of devices) {
      let knownDevice = await Device.findByProviderId('smartthings', deviceId);

      if (!knownDevice) {
        if (!deviceTypeMappings.has(deviceTypeName)) {
          console.warn(`SmartThings does not know how to handle devices of type '${deviceTypeName}'`);
          continue;
        }

        knownDevice = Device.build({
          type: deviceTypeMappings.get(deviceTypeName),
          provider: 'smartthings',
          providerId: deviceId
        });
      }

      knownDevice.name = label;
      await knownDevice.save();
    }
  }
});