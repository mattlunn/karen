import createSynologyInstance from './lib/';
import config from '../../config.json';

function synologyFactory() {
  return createSynologyInstance(
    config.synology.host,
    config.synology.port,
    config.synology.account,
    config.synology.password,
    config.synology.session
  );
}

let synologyInstance;

async function retryableSynologyRequest(count, ...args) {
  if (typeof synologyInstance === 'undefined') {
    synologyInstance = await synologyFactory();
  }

  try {
    return await synologyInstance.request(...args);
  } catch (error) {
    if (error.code === 105 && count > 0) {
      synologyInstance = undefined;

      return await retryableSynologyRequest(count - 1, ...args);
    }

    throw error;
  }
}

export default async function(...args) {
  return await retryableSynologyRequest(1, ...args);
}