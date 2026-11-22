#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
app_bundle="/Applications/T3 Code (Fork).app"
contents_dir="$app_bundle/Contents"
macos_dir="$contents_dir/MacOS"
resources_dir="$contents_dir/Resources"
source_icon="$repo_dir/assets/prod/black-macos-1024.png"

if [ ! -f "$source_icon" ]; then
  echo "Missing macOS icon source: $source_icon" >&2
  exit 1
fi

if [ ! -x /usr/bin/clang ]; then
  echo "Missing /usr/bin/clang (required to build native arm64 launcher)." >&2
  exit 1
fi

work_root=$(mktemp -d "${TMPDIR:-/tmp}/t3code-fork-app.XXXXXX")
trap 'rm -rf "$work_root"' EXIT INT TERM
iconset_dir="$work_root/icon.iconset"
mkdir -p "$iconset_dir"

for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$source_icon" --out "$iconset_dir/icon_${size}x${size}.png" >/dev/null
  retina=$((size * 2))
  sips -z "$retina" "$retina" "$source_icon" --out "$iconset_dir/icon_${size}x${size}@2x.png" >/dev/null
done

mkdir -p "$macos_dir" "$resources_dir"
iconutil -c icns "$iconset_dir" -o "$resources_dir/icon.icns"

escaped_start_script=$(printf '%s/scripts/start-local-fork-built.sh' "$repo_dir" | sed 's/\\/\\\\/g; s/"/\\"/g')
launcher_src="$work_root/launcher.c"
cat > "$launcher_src" <<EOF
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <pwd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>

static void ensure_dir(const char *path) {
  if (mkdir(path, 0755) != 0 && errno != EEXIST) {
    /* best effort */
  }
}

int main(int argc, char **argv) {
  const char *home = getenv("HOME");
  if (!home || !*home) {
    struct passwd *pw = getpwuid(getuid());
    home = pw ? pw->pw_dir : "/tmp";
  }

  char lib_dir[PATH_MAX];
  char logs_dir[PATH_MAX];
  char log_path[PATH_MAX];
  snprintf(lib_dir, sizeof(lib_dir), "%s/Library", home);
  snprintf(logs_dir, sizeof(logs_dir), "%s/Library/Logs", home);
  snprintf(log_path, sizeof(log_path), "%s/t3code-fork-launcher.log", logs_dir);
  ensure_dir(lib_dir);
  ensure_dir(logs_dir);

  int log_fd = open(log_path, O_WRONLY | O_CREAT | O_APPEND, 0644);
  if (log_fd >= 0) {
    dup2(log_fd, STDOUT_FILENO);
    dup2(log_fd, STDERR_FILENO);
    if (log_fd > STDERR_FILENO) {
      close(log_fd);
    }
  }

  time_t now = time(NULL);
  struct tm tm_now;
  localtime_r(&now, &tm_now);
  char ts[32];
  strftime(ts, sizeof(ts), "%Y-%m-%dT%H:%M:%S%z", &tm_now);

  printf("[%s] launching T3 Code (Fork) argc=%d", ts, argc);
  for (int i = 0; i < argc; i++) {
    printf(" argv[%d]=%s", i, argv[i]);
  }
  printf("\n");

  for (int i = 1; i < argc; i++) {
    if (strcmp(argv[i], "--check-only") == 0) {
      printf("check-only ok\n");
      fflush(stdout);
      return 0;
    }
  }

  const char *start_script = "$escaped_start_script";
  char *const child_argv[] = {
      "/bin/zsh",
      "-l",
      (char *)start_script,
      "--detach",
      NULL,
  };
  fflush(NULL);
  execv("/bin/zsh", child_argv);
  fprintf(stderr, "execv(/bin/zsh) failed for %s: %s\n", start_script, strerror(errno));
  fflush(stderr);
  return 1;
}
EOF

/usr/bin/clang -O2 -arch arm64 -Wall -Wextra "$launcher_src" -o "$macos_dir/T3 Code (Fork)"
chmod 755 "$macos_dir/T3 Code (Fork)"

cat > "$contents_dir/Info.plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>T3 Code (Fork)</string>
  <key>CFBundleExecutable</key>
  <string>T3 Code (Fork)</string>
  <key>CFBundleIconFile</key>
  <string>icon.icns</string>
  <key>CFBundleIdentifier</key>
  <string>com.t3tools.t3code.fork.launcher</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>T3 Code (Fork)</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSDesktopFolderUsageDescription</key>
  <string>T3 Code (Fork) accesses project workspaces in your Desktop folder.</string>
  <key>NSDocumentsFolderUsageDescription</key>
  <string>T3 Code (Fork) accesses project workspaces in your Documents folder.</string>
</dict>
</plist>
EOF

xattr -cr "$app_bundle" 2>/dev/null || true
codesign --force --deep --sign - --timestamp=none "$app_bundle"
touch "$app_bundle"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$app_bundle"
echo "Installed signed native launcher at $app_bundle"
