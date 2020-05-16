import LightwaveRfClient from './lib/client';
import config from '../../config';
import { saveConfig } from '../../helpers/config';
import { Device } from '../../models';

export const client = new LightwaveRfClient(config.lightwaverf.bearer, config.lightwaverf.refresh);

function findFeatureId(type, features) {
  return features.find(x => x.type === type).featureId;
}

function authenticate() {
  return client.authenticate().then(({ accessToken, refreshToken, expiresIn }) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Rotating LightwaveRf refresh token from ${config.lightwaverf.refresh} to ${refreshToken}`);
      console.log(`LightwaveRf access token is ${accessToken}`);
    }

    config.lightwaverf.refresh = refreshToken;
    saveConfig();

    setTimeout(() => {
      console.log('Time to re-authenticate against the LightwaveRF API...');
      authenticate();
    }, Math.max((expiresIn - 60) * 1000, 10000));
  }).then(null, console.error);
}

authenticate().then(() => Device.registerProvider('lightwaverf', {
  setProperty(device, key, value) {
    switch (key) {
      case 'on':
        return client.write(device.meta.switchFeatureId, +value);
      default:
        throw new Error(`"${key}" is not a recognised property for LightwaveRf`);
    }
  },

  async getProperty(device, key) {
    switch (key) {
      case 'on': {
        const latestEvent = await device.getLatestEvent('on');

        return !!(latestEvent && !latestEvent.end);
      }
      default:
        throw new Error(`"${key}" is not a recognised property for LightwaveRf`);
    }
  },

  async synchronize() {
    const structure = await client.structure(config.lightwaverf.structure);
    const lights = structure.devices.filter(device => device.cat === 'Lighting').map(device => device.featureSets).flat();

    for (const light of lights) {
      let device = await Device.findByProviderId('lightwaverf', light.featureSetId);

      if (device === null) {
        device = Device.build({
          provider: 'lightwaverf',
          providerId: light.featureSetId
        });
      }

      device.type = 'light';
      device.name = light.name;
      device.meta.switchFeatureId = findFeatureId('switch', light.features);
      device.meta.dimLevelFeatureId = findFeatureId('dimLevel', light.features);

      await device.save();
    }
  }
}));