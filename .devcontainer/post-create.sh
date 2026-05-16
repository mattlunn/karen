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

