#!/bin/bash
set -e

# Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Running `claude` inside the container always skips permission prompts,
# since the container itself is the security boundary.
echo "alias claude='claude --dangerously-skip-permissions'" >> ~/.bashrc

# Install project dependencies and generate capability types
cd /workspace/server/src
npm install
npm run codegen

# Point the app at the compose db service instead of localhost.
# config.json is gitignored so this only affects the mounted workspace copy.
node -e "
  const fs = require('fs');
  const path = 'config.json';
  if (!fs.existsSync(path)) {
    console.log('No config.json found — copy config.example.json and fill in your secrets.');
    process.exit(0);
  }
  const config = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (config.database) {
    config.database.host = 'host.docker.internal';
    fs.writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
    console.log('Updated database.host to db');
  }
"
