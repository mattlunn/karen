import config from '../../config';
import { saveConfig } from '../../helpers/config';
import fetch from 'node-fetch';
import { stringify } from 'querystring';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import SmartThingsApiClient from './lib/client';

// {"access_token":"583a45c7-d64c-45b1-a70b-b7de4de5c26d","token_type":"bearer","refresh_token":"f23a5350-16b4-4e1a-b39c-c05898856f3d","expires_in":86399,"scope":"r:locations:* x:devices:* i:deviceprofiles r:devices:* w:devices:*","installed_app_id":"14082a1f-8070-4796-be37-14939e34f938"}
async function refreshTokens() {
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
    return await response.json();
  } else {
    const message = await response.text();

    throw new Error(response.status + ': ' + message);
  }
}

nowAndSetInterval(async () => {
  const { refresh_token, access_token } = await refreshTokens();

  console.log(`Rotating SmartThings refresh token from ${config.smartthings.refresh_token} to ${refresh_token}`);

  if (process.env.NODE_ENV === 'development') {
    console.log(`SmartThings access token is '${access_token}'`);
  }

  config.smartthings.refresh_token = refresh_token;
  saveConfig();

  const client = new SmartThingsApiClient(access_token);
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
}, Math.min(config.smartthings.sync_interval_ms, 86400000));