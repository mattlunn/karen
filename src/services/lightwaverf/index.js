import LightwaveRfClient from './lib/client';
import config from '../../config';
import bus, * as events from '../../bus';
import { saveConfig } from '../../helpers/config';
import { Device } from '../../models';

export const client = new LightwaveRfClient(config.lightwaverf.bearer, config.lightwaverf.refresh);

function findFeatureId(type, features) {
  return features.find(x => x.type === type).featureId;
}

function authenticate() {
  return client.authenticate().then(({ accessToken, refreshToken, expiresIn }) => {
    console.log(`Rotating LightwaveRf refresh token from ${config.lightwaverf.refresh} to ${refreshToken}`);

    if (process.env.NODE_ENV === 'development') {
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

        return latestEvent && !latestEvent.end;
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

      await device.save();
    }
  }
}));

export async function setLightFeatureValue(featureId, value) {
  await client.write(featureId, value);
}

// TODO: Delete
export async function getLightsAndStatus() {
  const structure = await client.structure(config.lightwaverf.structure);
  const lights = structure.devices.filter(device => device.cat === 'Lighting');
  const featureValues = await client.read(lights.reduce((ar, { featureSets }) => {
    for (const { features } of featureSets) {
      ar.push(
        findFeatureId('switch', features),
        findFeatureId('dimLevel', features)
      );
    }

    return ar;
  }, []));

  return lights.reduce((ar, { featureSets }) => {
    for (const { name, features } of featureSets) {
      ar.push({
        id: name,
        name,
        switchFeatureId: findFeatureId('switch', features),
        switchIsOn: featureValues[findFeatureId('switch', features)] === 1,
        dimLevelFeatureId: findFeatureId('dimLevel', features),
        dimLevel: featureValues[findFeatureId('dimLevel', features)],
        provider: 'lightwaverf'
      });
    }

    return ar;
  }, []);
}