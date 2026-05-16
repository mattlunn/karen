#!/bin/bash
set -e

# Install MySQL client (includes mysqldump)
apt-get update -qq && apt-get install -y -q default-mysql-client

# Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Restore ~/.claude.json from Claude Code's own backup if it's missing after
# a container rebuild. ~/.claude is a named volume so the backups directory
# survives rebuilds even though ~/.claude.json itself does not.
if [ ! -f /root/.claude.json ]; then
  latest_backup=$(ls /root/.claude/backups/.claude.json.backup.* 2>/dev/null | sort -V | tail -n1)
  if [ -n "$latest_backup" ]; then
    cp "$latest_backup" /root/.claude.json
    echo "Restored /root/.claude.json from $latest_backup"
  fi
fi

# Running `claude` inside the container always skips permission prompts,
# since the container itself is the security boundary.
echo "alias claude='claude --dangerously-skip-permissions'" >> ~/.bashrc

# Install project dependencies and generate capability types
cd /workspace/server/src
npm install
npm run codegen

