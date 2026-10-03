import { join } from 'path';

export const CONFIG_DIR = '/opt/karen/config';
export const APP_CONFIG_PATH = join(CONFIG_DIR, 'app.json');
export const KEY_PATH = join(CONFIG_DIR, 'config.key');
export const STATE_PATH = join(CONFIG_DIR, 'state.json');
