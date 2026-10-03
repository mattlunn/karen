import { z } from 'zod';
import config from '../config';
import logger from '../logger';

// The config lives outside the repo and is edited per-environment (and, on prod, at runtime),
// so nothing checks it at build time - each automation's parameter type is an assertion about a
// file tsc never reads. Validate against the schema each automation exports instead, before
// starting it.
for (const [index, { name, parameters }] of config.automations.entries()) {
  const automation = require(`./${name}`);
  const result = automation.parameters.safeParse(parameters);

  if (!result.success) {
    throw new Error(`config is invalid; automations[${index}] "${name}":\n${z.prettifyError(result.error)}`);
  }

  logger.info({ automation: name }, 'Starting automation');
  automation.default(result.data);
}
