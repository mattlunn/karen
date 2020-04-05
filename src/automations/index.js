import config from '../config';

for (const { name, parameters } of config.automations) {
  require(`./${name}`).default(parameters);
}