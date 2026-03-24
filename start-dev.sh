#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/thiagpio/Desktop/AXCR/aexion-core
exec pnpm dev --port 3000
