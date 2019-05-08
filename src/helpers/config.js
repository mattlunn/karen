import { writeFileSync } from 'fs';
import config from '../config';

export function saveConfig() {
  writeFileSync(__dirname + '/../config.json', JSON.stringify(config, null, 2));
}