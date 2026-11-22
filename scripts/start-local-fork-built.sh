#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
export PATH="$HOME/.local/share/vite-plus/js_runtime/node/26.13.1/bin:$HOME/.local/share/t3code-node26-arm64/bin:/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:${PATH:-/usr/bin:/bin:/usr/sbin:/sbin}"

unset VITE_DEV_SERVER_URL
unset ELECTRON_RUN_AS_NODE

if [ ! -f "$repo_dir/apps/desktop/dist-electron/main.cjs" ] || \
   [ ! -f "$repo_dir/apps/server/dist/bin.mjs" ] || \
   [ ! -f "$repo_dir/apps/server/dist/client/index.html" ]; then
  "$repo_dir/scripts/rebuild-local-fork.sh" --full
fi

exec node "$repo_dir/scripts/launch-local-fork-built.mjs" "$@"
