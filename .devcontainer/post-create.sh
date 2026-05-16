#!/bin/bash
set -e

# Install Claude Code CLI into a user-writable location (node user can't write to /usr/local)
npm config set prefix ~/.npm-global
export PATH="$HOME/.npm-global/bin:$PATH"
npm install -g @anthropic-ai/claude-code

# Running `claude` inside the container always skips permission prompts,
# since the container itself is the security boundary.
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
echo "alias claude='claude --dangerously-skip-permissions'" >> ~/.bashrc

# Install project dependencies and generate capability types
cd /workspace/server/src
npm install
npm run codegen

