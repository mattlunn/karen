import { watchFile } from 'fs';
import automations from '../config/automations.json';
import logger from '../logger';

for (const { name, parameters } of automations) {
  require(`./${name}`).default(parameters);
}

watchFile(require.resolve('../config/automations.json'), { interval: 5000 }, () => {
  logger.info('config/automations.json changed; exiting to restart and apply new config');
  process.exit(0);
});