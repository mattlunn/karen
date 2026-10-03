import { join } from 'path';

// server/config sits beside src and dist, so this resolves to it from source (tsx) and from a build alike.
export const CONFIG_DIR = join(__dirname, '..', '..', '..', 'config');
export const APP_CONFIG_PATH = join(CONFIG_DIR, 'app.json');
export const KEY_PATH = join(CONFIG_DIR, 'config.key');
export const STATE_PATH = join(CONFIG_DIR, 'state.json');
