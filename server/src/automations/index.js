import { watchFile } from 'fs';
import { z } from 'zod';
import automations from '../config/automations.json';
import logger from '../logger';

// config/automations.json is gitignored and edited per-environment (and, on prod, at runtime),
// so nothing checks it at build time - each automation's parameter type is an assertion about a
// file tsc never reads. Validate against the schema each automation exports instead, and do it
// for every entry before starting any of them, so one bad entry reports alongside the rest
// rather than leaving the house half-configured.
const loaded = [];
const errors = [];

for (const [index, { name, parameters }] of automations.entries()) {
  const automation = require(`./${name}`);
  const result = automation.parameters.safeParse(parameters);

  if (result.success) {
    loaded.push([name, automation, result.data]);
  } else {
    errors.push(`  automations[${index}] "${name}":\n${z.prettifyError(result.error).replace(/^/gm, '    ')}`);
  }
}

if (errors.length > 0) {
  throw new Error(`config/automations.json is invalid:\n${errors.join('\n')}`);
}

for (const [name, automation, parameters] of loaded) {
  logger.info({ automation: name }, 'Starting automation');
  automation.default(parameters);
}

watchFile(require.resolve('../config/automations.json'), { interval: 5000 }, () => {
  logger.info('config/automations.json changed; exiting to restart and apply new config');
  process.exit(0);
});
