#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const packageDir = join(import.meta.dirname, 'skill-package');
const modelsDir = join(packageDir, 'interactionModels', 'custom');
const skillId = requireEnv('ALEXA_SKILL_ID');

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} must be set`);
  }

  return value;
}

function ask(args, { capture = false } = {}) {
  return execFileSync('ask', ['smapi', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', capture ? 'pipe' : 'inherit', 'inherit']
  });
}

async function waitFor(resource, selectUpdate) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const status = JSON.parse(ask(['get-skill-status', '-s', skillId, '--resource', resource], { capture: true }));
    const update = selectUpdate(status).lastUpdateRequest;

    if (update.status === 'SUCCEEDED') {
      return;
    }

    if (update.status === 'FAILED') {
      throw new Error(`${resource} update failed: ${JSON.stringify(update, null, 2)}`);
    }

    await sleep(5000);
  }

  throw new Error(`Timed out waiting for ${resource} to update`);
}

const manifest = readFileSync(join(packageDir, 'skill.json'), 'utf8')
  .replace(/\$\{([A-Z_]+)\}/g, (_, name) => JSON.stringify(requireEnv(name)).slice(1, -1));

ask(['update-skill-manifest', '-s', skillId, '-g', 'development', '--manifest', manifest]);
await waitFor('manifest', (status) => status.manifest);
console.log('Manifest updated');

for (const file of readdirSync(modelsDir)) {
  const locale = basename(file, '.json');

  ask(['set-interaction-model', '-s', skillId, '-g', 'development', '-l', locale, '--interaction-model', `file:${join(modelsDir, file)}`]);
  await waitFor('interactionModel', (status) => status.interactionModel[locale]);
  console.log(`Interaction model for ${locale} built`);
}
