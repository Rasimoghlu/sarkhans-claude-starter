#!/bin/bash
set -euo pipefail

APP_NAME="Sarkhans Claude Starter"
DOWNLOAD_URL="https://github.com/sarkhandigitech/sarkhans-claude-starter/releases/latest/download/Sarkhans-Claude-Starter.zip"

fail() {
  echo "✖ $1" >&2
  exit 1
}

[ "$(uname -s)" = "Darwin" ] || fail "This installer is for macOS."

if [ -d "/Applications/$APP_NAME.app" ]; then
  DEST="/Applications"
elif [ -d "$HOME/Applications/$APP_NAME.app" ]; then
  DEST="$HOME/Applications"
elif [ -w "/Applications" ]; then
  DEST="/Applications"
else
  DEST="$HOME/Applications"
fi
[ -w "$DEST" ] || [ ! -e "$DEST" ] || DEST="$HOME/Applications"
mkdir -p "$DEST"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "→ Downloading $APP_NAME…"
curl -fsSL "$DOWNLOAD_URL" -o "$WORK/app.zip" || fail "Download failed. Check your internet connection and try again."
ditto -x -k "$WORK/app.zip" "$WORK" || fail "The download couldn't be unpacked."
[ -d "$WORK/$APP_NAME.app" ] || fail "The download doesn't contain the app."
codesign --verify --deep --strict "$WORK/$APP_NAME.app" 2>/dev/null || fail "The downloaded app failed its signature check."

if pgrep -xq ClaudeStarter; then
  echo "→ Closing the running app…"
  osascript -e "quit app \"$APP_NAME\"" >/dev/null 2>&1 || true
  for _ in $(seq 1 25); do pgrep -xq ClaudeStarter || break; sleep 0.2; done
fi

rm -rf "$DEST/$APP_NAME.app"
mv "$WORK/$APP_NAME.app" "$DEST/"
xattr -dr com.apple.quarantine "$DEST/$APP_NAME.app" 2>/dev/null || true

echo "✔ Installed in $DEST. Opening…"
open "$DEST/$APP_NAME.app"
