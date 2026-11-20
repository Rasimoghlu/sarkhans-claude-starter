#!/bin/bash
set -euo pipefail

APP_NAME="Sarkhans Claude Starter"
ARTIFACT="Sarkhans-Claude-Starter"
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="${1:-}"
if [ -z "$SRC" ]; then
  if [ -d "$HERE/Sources" ] && [ -f "$HERE/claude-web-starter.zip" ]; then
    SRC="$HERE"
  elif [ -d "$HOME/Desktop/$APP_NAME.app/Contents/Resources" ]; then
    SRC="$HOME/Desktop/$APP_NAME.app/Contents/Resources"
  else
    SRC="$HOME/Desktop/ClaudeStarter.app/Contents/Resources"
  fi
fi
OUT="${OUT:-$HOME/Desktop}"

finish() {
  if [ -t 0 ]; then
    echo
    read -r -n 1 -p "Press any key to close…" || true
    echo
  fi
}
trap finish EXIT

fail() {
  echo "✖ $1" >&2
  exit 1
}

compgen -G "$SRC/Sources/*.swift" >/dev/null || fail "Missing Swift sources in $SRC/Sources"
for file in AppIcon.icns claude-web-starter.zip starter-version.txt; do
  [ -f "$SRC/$file" ] || fail "Missing $SRC/$file"
done
PLIST="$SRC/Info.plist"
[ -f "$PLIST" ] || PLIST="$SRC/../Info.plist"
[ -f "$PLIST" ] || fail "Missing Info.plist next to $SRC"

VERSION="$(tr -d '[:space:]' < "$SRC/starter-version.txt")"
UPDATE_REPO="${UPDATE_REPO:-${GITHUB_REPOSITORY:-}}"
if [ -z "$UPDATE_REPO" ] && [ -f "$SRC/update-repo.txt" ]; then
  UPDATE_REPO="$(grep -v '^#' "$SRC/update-repo.txt" | tr -d '[:space:]' || true)"
fi

if ! xcrun --find swiftc >/dev/null 2>&1; then
  xcode-select --install >/dev/null 2>&1 || true
  fail "Swift compiler not found. Finish the Command Line Tools installer that just opened, then run this again."
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"; finish' EXIT
STAGE="$WORK/stage"
APP="$STAGE/$APP_NAME.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$OUT"

echo "→ $APP_NAME $VERSION"
echo "→ Compiling for Apple Silicon…"
xcrun swiftc -O -parse-as-library -target arm64-apple-macos13.0 "$SRC"/Sources/*.swift -o "$WORK/ui-arm64"
echo "→ Compiling for Intel…"
xcrun swiftc -O -parse-as-library -target x86_64-apple-macos13.0 "$SRC"/Sources/*.swift -o "$WORK/ui-x86_64"
xcrun lipo -create "$WORK/ui-arm64" "$WORK/ui-x86_64" -output "$APP/Contents/MacOS/ClaudeStarter"

cp "$PLIST" "$APP/Contents/Info.plist"
for pair in "CFBundleExecutable=ClaudeStarter" "CFBundleName=$APP_NAME" "CFBundleDisplayName=$APP_NAME" \
            "CFBundleShortVersionString=$VERSION" "CFBundleVersion=$VERSION"; do
  plutil -replace "${pair%%=*}" -string "${pair#*=}" "$APP/Contents/Info.plist"
done
printf 'APPL????' > "$APP/Contents/PkgInfo"
cp "$SRC/AppIcon.icns" "$SRC/claude-web-starter.zip" "$SRC/starter-version.txt" "$APP/Contents/Resources/"
if [ -n "$UPDATE_REPO" ]; then
  echo "$UPDATE_REPO" > "$APP/Contents/Resources/update-repo.txt"
  echo "→ Updates from github.com/$UPDATE_REPO"
else
  echo "→ No update source (set UPDATE_REPO=owner/repo or build on GitHub Actions)"
fi

IDENTITY="${SIGN_IDENTITY:-$(security find-identity -v -p codesigning 2>/dev/null | awk -F'"' '/Developer ID Application/ {print $2; exit}')}"
if [ -n "$IDENTITY" ]; then
  echo "→ Signing with: $IDENTITY"
  codesign --force --deep --options runtime --timestamp -s "$IDENTITY" "$APP"
else
  echo "→ No Developer ID certificate found, using ad-hoc signature"
  codesign --force --deep -s - "$APP"
fi
codesign --verify --deep --strict "$APP"

ZIP="$OUT/$ARTIFACT.zip"
rm -f "$ZIP"
ditto -c -k --keepParent "$APP" "$ZIP"

NOTARIZED=false
ln -s /Applications "$STAGE/Applications"

write_readme() {
  {
    echo "$APP_NAME $VERSION — INSTALL"
    echo
    echo "1. Drag \"$APP_NAME\" into the Applications folder."
    echo "   No admin rights on this Mac? Use the Applications folder in your home folder instead"
    echo "   (Finder → Go → Home; create a folder named Applications if it isn't there)."
    echo "2. Open it from Applications."
    if ! $NOTARIZED; then
      echo
      echo "   The app isn't notarized by Apple, so macOS asks you to confirm it once:"
      echo "   macOS 15 Sequoia / 26 Tahoe / 27 Golden Gate:"
      echo "   a) Double-click the app. In \"Not Opened\" click Done (not Move to Trash)."
      echo "   b) Apple menu → System Settings → Privacy & Security → scroll down to Security."
      echo "   c) Next to \"$APP_NAME was blocked to protect your Mac\" click Open Anyway."
      echo "   d) Click Open Anyway again and confirm with your password or Touch ID."
      echo "      The button stays for about an hour after a). If it's gone, do a) again."
      echo "   macOS 13 Ventura / 14 Sonoma: right-click the app → Open → Open."
      echo "   This is needed only once. Updates install themselves from inside the app."
    fi
    echo
    echo "3. In the app:"
    echo "   • If asked, press \"Install Node.js\" and/or \"Install Git\" and finish those installers."
    echo "   • Choose the folder with your projects."
    echo "   • Select projects and press Set up."
    echo
    echo "Claude Code must be installed: https://docs.claude.com/en/docs/claude-code/overview"
  } > "$STAGE/READ ME FIRST.txt"
}

DMG="$OUT/$ARTIFACT.dmg"
build_dmg() {
  rm -f "$DMG"
  for attempt in 1 2 3; do
    if hdiutil create -volname "$APP_NAME $VERSION" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null; then
      return 0
    fi
    sleep 3
  done
  fail "hdiutil couldn't create the installer"
}

write_readme
echo "→ Creating installer…"
build_dmg

if [ -n "$IDENTITY" ] && [ -n "${NOTARY_PROFILE:-}" ]; then
  echo "→ Notarizing with Apple (a few minutes)…"
  NOTARIZED=true
  write_readme
  build_dmg
  codesign --force --timestamp -s "$IDENTITY" "$DMG"
  xcrun notarytool submit "$DMG" --keychain-profile "$NOTARY_PROFILE" --wait
  xcrun stapler staple "$DMG"
fi

echo
echo "✔ Installer: $DMG"
echo "✔ Update package: $ZIP"
echo "  Universal app (Apple Silicon + Intel), version $VERSION, no Xcode needed on the other Mac."
if ! $NOTARIZED; then
  echo "  Not notarized: colleagues approve it once (see READ ME FIRST.txt inside the installer)."
fi
if [ -z "${CI:-}" ]; then
  open -R "$DMG" >/dev/null 2>&1 || true
fi
