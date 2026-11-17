#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist"
DEV=false
for arg in "$@"; do
  case "$arg" in
    --dev) DEV=true ;;
    --out=*) OUT="${arg#--out=}" ;;
    *) echo "usage: build-app.sh [--dev] [--out=DIR]"; exit 1 ;;
  esac
done
mkdir -p "$OUT"

SRC="$(mktemp -d)"
trap 'rm -rf "$SRC"' EXIT
cp "$ROOT/macos-app/ClaudeStarter.swift" "$ROOT/macos-app/AppIcon.icns" "$ROOT/macos-app/Info.plist" "$SRC/"
[ -f "$ROOT/macos-app/update-repo.txt" ] && cp "$ROOT/macos-app/update-repo.txt" "$SRC/"
(cd "$ROOT" && zip -qr "$SRC/claude-web-starter.zip" claude-web-starter -x '*.DS_Store' -x 'claude-web-starter/.git/*')
cp "$ROOT/claude-web-starter/VERSION" "$SRC/starter-version.txt"

if ! $DEV; then
  OUT="$OUT" bash "$ROOT/macos-app/make-shareable.sh" "$SRC" </dev/null
  exit 0
fi

APP="$OUT/Sarkhans Claude Starter.app"
RES="$APP/Contents/Resources"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$RES"
cp "$SRC/Info.plist" "$APP/Contents/"
printf 'APPL????' > "$APP/Contents/PkgInfo"
xcrun clang -O2 -arch arm64 -arch x86_64 -o "$APP/Contents/MacOS/ClaudeStarter" "$ROOT/macos-app/launcher.c"
cp "$SRC/ClaudeStarter.swift" "$SRC/AppIcon.icns" "$SRC/claude-web-starter.zip" "$SRC/starter-version.txt" "$RES/"
cp "$ROOT/macos-app/launch.sh" "$ROOT/macos-app/make-shareable.sh" "$RES/"
chmod +x "$RES/launch.sh" "$RES/make-shareable.sh"
codesign --force --deep -s - "$APP"
echo "Built dev app (compiles the Swift source on first launch): $APP"
