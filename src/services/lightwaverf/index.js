import lightwaveRfClientFactory from './lib/client/src';
import config from '../../config';
import bus, * as events from '../../bus';

const authenticatedClient = (async function() {
  const client = await lightwaveRfClientFactory(config.lightwaverf.username, config.lightwaverf.password, {
    timeout: config.lightwaverf.timeout
  });

  client.on('close', (reason) => {
    (function tryReconnect(counter) {
      setTimeout(() => {
        console.error(`LWRF connection has closed... trying to reconnect for the ${counter} time`, reason);

        client.reconnect().then(() => {
          console.log('LWRF connection re-established');
        }, () => {
          console.error('LWRF connection could not be re-established... trying again in a bit...');

          tryReconnect(counter + 1);
        });
      }, 5000);
    }(1));
  });

  client.on('error', (err) => {
    console.error('LWRF connection error', err);
  });

  return client;
}());

export async function setLightFeatureValue(featureId, value) {
  const client = await authenticatedClient;
  const feature = await client.request('feature', 'read', {
    featureId
  });

  if (!['switch', 'dimLevel'].includes(feature._feature.featureType)) {
    throw new Error('Not allowed to edit ' + feature.attributes.type);
  } else {
    await client.request('feature', 'write', {
      featureId,
      value
    });
  }
}

export async function getLightsAndStatus() {
  const client = await authenticatedClient;
  const rgId = config.lightwaverf.root_group_id;
  const typesOfLight = config.lightwaverf.types_of_light;
  const [
    hierarchy,
    group,
  ] = await Promise.all([
    client.request('group', 'hierarchy', {
      groupId: rgId
    }),

    client.request('group', 'read', {
      groupId: rgId,
      features: 1,
      devices: 1,
      subgroups: true,
      subgroupDepth: 10
    })
  ]);

  function getFeatureForFeatureSet(featureSetId, type) {
    return Object.values(group.features).find((feature) => {
      return feature.groups.includes(featureSetId) && feature.attributes.type === type;
    });
  }

  return await Promise.all(Object.values(group.devices).filter((device) => {
    return typesOfLight.includes(device.productCode);
  }).reduce((list, device) => {
    for (const featureSetId of device.featureSetGroupIds) {
      const name = hierarchy.featureSet.find(featureSet => featureSet.groupId === featureSetId).name;
      const switchFeature = getFeatureForFeatureSet(featureSetId, 'switch');
      const dimLevelFeature = getFeatureForFeatureSet(featureSetId, 'dimLevel');

      list.push((async function () {
        const [
          switchStatus,
          dimLevelStatus
        ] = await Promise.all([
          client.request('feature', 'read', {
            featureId: switchFeature.featureId
          }),

          client.request('feature', 'read', {
            featureId: dimLevelFeature.featureId
          })
        ]);

        return {
          name,
          switchFeatureId: switchFeature.featureId,
          switchIsOn: switchStatus.value === 1,
          dimLevelFeatureId: dimLevelFeature.featureId,
          dimLevel: dimLevelStatus.value,
          type: 'lightwaverf'
        };
      }()));
    }

    return list;
  }, []));
}

bus.on(events.LAST_USER_LEAVES, async () => {
  const devices = await getLightsAndStatus();
  const client = await authenticatedClient;
  const onDevices = devices.filter(device => device.switchIsOn);

  for (const device of onDevices) {
    console.log(`Turning ${device.name} off, as no-one is at home, and it has been left on!`);

    client.request('feature', 'write', {
      featureId: device.switchFeatureId,
      value: 0
    });
  }
});