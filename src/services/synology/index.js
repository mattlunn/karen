import bus, { LAST_USER_LEAVES, FIRST_USER_HOME } from '../../bus';
import createSynologyInstance from './lib/';
import config from '../../config.json';

export const withSynology = createSynologyInstance(
  config.synology.host,
  config.synology.port,
  config.synology.account,
  config.synology.password,
  config.synology.session
);

async function setHomeMode(on) {
  const synology = await withSynology;

  await synology.request('SYNO.SurveillanceStation.HomeMode', 'Switch', {
    on
  }, true);
}

bus.on(LAST_USER_LEAVES, async () => {
  try {
    await setHomeMode(false);
  } catch (e) {
    console.error(e);
  }
});

bus.on(FIRST_USER_HOME, async () => {
  try {
    await setHomeMode(true);
  } catch (e) {
    console.error(e);
  }
});