import { writeFileSync } from 'fs';
import config from '../config/app';

export function saveConfig() {
  writeFileSync(__dirname + '/../config/app.json', JSON.stringify(config, null, 2));
}