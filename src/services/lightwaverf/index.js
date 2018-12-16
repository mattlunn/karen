import LightwaveRfClient from './lib/client/src';
import config from '../../config';
import bus, * as events from '../../bus';

const authenticatedClient = (async function() {
  const client = new LightwaveRfClient();

  await client.authenticate(config.lightwaverf.username, config.lightwaverf.password);
  await client.request('user', 'authenticate', {
    token: client._accessToken
  });

  return client;
}());

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
          dimLevel: dimLevelStatus.value
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