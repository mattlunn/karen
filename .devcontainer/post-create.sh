#!/bin/bash
set -e

# Install MySQL client (mysqldump) and openssh-client (ssh-keygen, ssh-keyscan).
apt-get update -qq && apt-get install -y -q default-mysql-client openssh-client jq iputils-ping vim

# Provision a karen-only deploy key in the persisted ~/.ssh volume.
# On first run we generate the key and print the public half so it can
# be pasted into mattlunn/karen → Settings → Deploy keys. Subsequent
# rebuilds reuse the existing key from the volume.
chmod 700 ~/.ssh
if [ ! -f ~/.ssh/id_ed25519_karen ]; then
  ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_karen -N '' -C 'karen-devcontainer' -q
  cat <<EOF

================================================================
A new SSH key has been generated for this devcontainer.

Add the public key below as a deploy key (with write access) at:
  https://github.com/mattlunn/karen/settings/keys

$(cat ~/.ssh/id_ed25519_karen.pub)
================================================================

EOF
fi
chmod 600 ~/.ssh/id_ed25519_karen

# Pin this key to github.com only — IdentitiesOnly stops SSH from
# offering it (or anything else) to other hosts by accident.
cat > ~/.ssh/config <<'SSHCONFIG'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_karen
  IdentitiesOnly yes
SSHCONFIG
chmod 600 ~/.ssh/config

# Pre-seed GitHub's host key so non-interactive SSH doesn't prompt.
ssh-keyscan -t ed25519,rsa github.com >> ~/.ssh/known_hosts 2>/dev/null
sort -u ~/.ssh/known_hosts -o ~/.ssh/known_hosts
chmod 644 ~/.ssh/known_hosts

# Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Running `claude` inside the container always skips permission prompts,
# since the container itself is the security boundary.
echo "alias claude='claude --dangerously-skip-permissions'" >> ~/.bashrc

# Install project dependencies and generate capability types
cd /workspace/server/src
npm install
npm run codegen

