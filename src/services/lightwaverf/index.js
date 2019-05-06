import LightwaveRfClient from './lib/client';
import config from '../../config';
import bus, * as events from '../../bus';
import { writeFileSync } from 'fs';

const client = new LightwaveRfClient(config.lightwaverf.bearer, config.lightwaverf.refresh);

function findFeatureId(type, features) {
  return features.find(x => x.type === type).featureId;
}

function authenticate() {
  client.authenticate().then(({ refreshToken, expiresIn }) => {
    console.log(`Rotating refresh token from ${config.lightwaverf.refresh} to ${refreshToken}`);

    config.lightwaverf.refresh = refreshToken;
    writeFileSync(__dirname + '/../../config.json', JSON.stringify(config, null, 2));

    setTimeout(() => {
      console.log('Time to re-authenticate against the LightwaveRF API...');
      authenticate();
    }, Math.max((expiresIn - 60) * 1000, 10000));
  }).then(null, console.error);
}

authenticate();

export async function setLightFeatureValue(featureId, value) {
  await client.write(featureId, value);
}

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

bus.on(events.LAST_USER_LEAVES, async () => {
  const devices = await getLightsAndStatus();
  const onDevices = devices.filter(device => device.switchIsOn);

  console.log(`Turning off ${onDevices.length} lights, as they have all been left on!`);

  await client.write(onDevices.map(({ switchFeatureId }) => ({ featureId: switchFeatureId, value: 0 })));
});