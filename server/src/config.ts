import { loadConfig } from './helpers/config/load';
import { APP_CONFIG_PATH, KEY_PATH } from './helpers/config/paths';
import { AppConfig, DeepReadonly } from './helpers/config/types';

const config: DeepReadonly<AppConfig> = loadConfig(APP_CONFIG_PATH, KEY_PATH);

export default config;
