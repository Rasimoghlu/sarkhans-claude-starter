#!/bin/bash
set -u
RESOURCES="$(cd "$(dirname "$0")" && pwd)"
SOURCES="$RESOURCES/Sources"
TARGET_DIR="$RESOURCES/../MacOS"
if [ ! -w "$TARGET_DIR" ]; then
  TARGET_DIR="$HOME/Library/Application Support/ClaudeStarter"
  mkdir -p "$TARGET_DIR"
fi
BINARY="$TARGET_DIR/ClaudeStarterUI"
HASH_FILE="$BINARY.sha256"
BUILD_LOG="$HOME/Library/Logs/ClaudeStarter-build.log"

alert() {
  /usr/bin/osascript -e "display alert \"Sarkhan’s Claude Starter\" message \"$1\"" >/dev/null 2>&1
}

SOURCE_HASH="$(cat "$SOURCES"/*.swift | /usr/bin/shasum -a 256 | cut -d' ' -f1)"
BUILT_HASH="$(cat "$HASH_FILE" 2>/dev/null || true)"

if [ ! -x "$BINARY" ] || [ "$SOURCE_HASH" != "$BUILT_HASH" ]; then
  if ! /usr/bin/xcrun --find swiftc >/dev/null 2>&1; then
    alert "Swift compiler not found. Run this in Terminal: xcode-select --install — then open the app again."
    exit 1
  fi
  /usr/bin/osascript -e 'display notification "Updating the app (~30 seconds)…" with title "Sarkhan’s Claude Starter"' >/dev/null 2>&1 &
  mkdir -p "$(dirname "$BUILD_LOG")"
  if ! /usr/bin/xcrun swiftc -O -parse-as-library "$SOURCES"/*.swift -o "$BINARY.tmp" >"$BUILD_LOG" 2>&1; then
    alert "The app could not be built. Details: ~/Library/Logs/ClaudeStarter-build.log"
    exit 1
  fi
  mv -f "$BINARY.tmp" "$BINARY"
  echo "$SOURCE_HASH" > "$HASH_FILE"
fi

exec "$BINARY"
