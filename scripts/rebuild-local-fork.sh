#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
export PATH="$HOME/.local/share/vite-plus/js_runtime/node/26.13.1/bin:$HOME/.local/share/t3code-node26-arm64/bin:/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:${PATH:-/usr/bin:/bin:/usr/sbin:/sbin}"

mode="full"
relaunch=0

for arg in "$@"; do
  case "$arg" in
    --web)
      mode="web"
      ;;
    --full)
      mode="full"
      ;;
    --relaunch)
      relaunch=1
      ;;
    -h|--help)
      cat <<'EOF'
Usage: ./scripts/rebuild-local-fork.sh [--full | --web] [--relaunch]

Options:
  --full      Build web, server, and desktop bundles (default).
  --web       Rebuild only apps/web and refresh apps/server/dist/client (no restart needed).
  --relaunch  With --full, gracefully restart the tracked local fork Electron instance.
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

if [ "$mode" = "web" ] && [ "$relaunch" -eq 1 ]; then
  echo "--relaunch is only supported with --full; for --web, press Cmd+Shift+R (or Cmd+R) in T3 Code." >&2
  exit 1
fi

cd "$repo_dir"

if [ "$mode" = "web" ]; then
  "$repo_dir/node_modules/.bin/vp" run --filter @t3tools/web build
  if [ ! -f "$repo_dir/apps/web/dist/index.html" ]; then
    echo "Web build finished without apps/web/dist/index.html." >&2
    exit 1
  fi

  mkdir -p "$repo_dir/apps/server/dist"
  client_dir="$repo_dir/apps/server/dist/client"
  tmp_dir="$repo_dir/apps/server/dist/client.tmp.$$"
  rm -rf "$tmp_dir"
  trap 'rm -rf "$tmp_dir"' EXIT INT TERM
  cp -R "$repo_dir/apps/web/dist" "$tmp_dir"
  rm -rf "$client_dir"
  mv "$tmp_dir" "$client_dir"
  trap - EXIT INT TERM

  echo "Web UI rebuilt in apps/server/dist/client."
  echo "Press Cmd+Shift+R (or Cmd+R) in T3 Code to reload with zero server/agent interruption."
  exit 0
fi

"$repo_dir/node_modules/.bin/vp" run build:desktop

for required in \
  "$repo_dir/apps/desktop/dist-electron/main.cjs" \
  "$repo_dir/apps/server/dist/bin.mjs" \
  "$repo_dir/apps/server/dist/client/index.html"; do
  if [ ! -f "$required" ]; then
    echo "Expected build output missing: $required" >&2
    exit 1
  fi
done

if [ "$relaunch" -eq 0 ]; then
  echo "Full local fork build complete."
  exit 0
fi

pid_file="$HOME/Library/Logs/t3code-fork-electron.pid"
relaunched=0
if [ -f "$pid_file" ]; then
  pid=$(tr -d '[:space:]' < "$pid_file" || true)
  case "$pid" in
    ''|*[!0-9]*) pid="" ;;
  esac
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    cmd=$(ps -p "$pid" -o command= 2>/dev/null || true)
    expected_fork_bin="$repo_dir/apps/desktop/.electron-runtime/T3 Code (Fork).app"
    expected_beta_bin="$repo_dir/apps/desktop/.electron-runtime/T3 Code (Beta).app"
    if [ -z "$cmd" ] || printf '%s' "$cmd" | grep -Fq "$expected_fork_bin" || printf '%s' "$cmd" | grep -Fq "$expected_beta_bin"; then
      log_file="$HOME/Library/Logs/t3code-fork-relaunch.log"
      echo "Relaunching T3 Code fork (stopping PID $pid) — handoff log: $log_file"
      REBUILD_TARGET_PID="$pid" \
      REBUILD_PID_FILE="$pid_file" \
      REBUILD_START_SCRIPT="$repo_dir/scripts/start-local-fork-built.sh" \
      REBUILD_LOG_FILE="$log_file" \
      node -e '
        const cp = require("node:child_process");
        const fs = require("node:fs");
        const path = require("node:path");

        const logFile = process.env.REBUILD_LOG_FILE;
        fs.mkdirSync(path.dirname(logFile), { recursive: true });
        const logFd = fs.openSync(logFile, "w");

        const worker = `
          const cp = require("node:child_process");
          const fs = require("node:fs");
          const pid = Number(process.env.REBUILD_TARGET_PID);
          const pidFile = process.env.REBUILD_PID_FILE;
          const startScript = process.env.REBUILD_START_SCRIPT;
          const isAlive = () => {
            try { process.kill(pid, 0); return true; } catch { return false; }
          };
          setTimeout(async () => {
            try {
              if (isAlive()) process.kill(pid, "SIGTERM");
            } catch (error) {
              console.error("Failed to stop fork PID " + pid + ":", error);
              process.exit(1);
            }
            for (let i = 0; i < 60 && isAlive(); i += 1) {
              await new Promise((resolve) => setTimeout(resolve, 250));
            }
            if (isAlive()) {
              console.error("T3 Code fork (PID " + pid + ") did not exit within 15s.");
              process.exit(1);
            }
            try { fs.rmSync(pidFile, { force: true }); } catch {}
            const result = cp.spawnSync(startScript, ["--detach"], { stdio: "inherit" });
            process.exit(result.status ?? 0);
          }, 150);
        `;

        const child = cp.spawn(process.execPath, ["-e", worker], {
          detached: true,
          stdio: ["ignore", logFd, logFd],
          env: {
            ...process.env,
            REBUILD_TARGET_PID: process.env.REBUILD_TARGET_PID,
            REBUILD_PID_FILE: process.env.REBUILD_PID_FILE,
            REBUILD_START_SCRIPT: process.env.REBUILD_START_SCRIPT,
          },
        });
        fs.closeSync(logFd);
        child.unref();
      '
      relaunched=1
    else
      echo "Tracked PID $pid does not match $expected_fork_bin or $expected_beta_bin; refusing to stop it." >&2
      exit 1
    fi
  fi
fi

if [ "$relaunched" -eq 0 ]; then
  echo "Full build ready. No tracked running T3 Code (Fork) PID found — open 'T3 Code (Fork)' (after quitting official 'T3 Code (Beta)' if open)."
fi
