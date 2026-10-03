import { loadConfig } from './load';
import { APP_CONFIG_PATH, KEY_PATH } from './paths';
import { AppConfig, DeepReadonly } from './types';

const config: DeepReadonly<AppConfig> = loadConfig(APP_CONFIG_PATH, KEY_PATH);

export default config;
