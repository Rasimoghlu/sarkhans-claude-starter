#!/bin/bash
set -euo pipefail
trap 'echo; echo "Something went wrong — send a screenshot of the message above."; read -n 1 -s -r -p "Press any key to close..."' ERR
clear
echo "== Homebrew + Node.js setup =="
echo

if [ "$(uname -m)" = "arm64" ]; then BREW_PREFIX=/opt/homebrew; else BREW_PREFIX=/usr/local; fi

if [ -x "$BREW_PREFIX/bin/brew" ]; then
  echo "1/3 Homebrew is already installed."
else
  echo "1/3 Installing Homebrew."
  echo "    It will ask for your Mac password (typing is invisible) and to press RETURN."
  echo
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

eval "$("$BREW_PREFIX/bin/brew" shellenv)"
if ! grep -qs 'brew shellenv' "$HOME/.zprofile"; then
  echo "eval \"\$($BREW_PREFIX/bin/brew shellenv)\"" >> "$HOME/.zprofile"
fi

echo
if [ -x "$BREW_PREFIX/bin/node" ]; then
  echo "2/3 Node.js is already installed."
else
  echo "2/3 Installing Node.js..."
  brew install node
fi

echo
echo "3/3 Check:"
echo "    brew   $(brew --version | head -1)"
echo "    node   $(node -v)"
echo "    npm    $(npm -v)"
if xcrun --find swiftc >/dev/null 2>&1; then
  echo "    swiftc available"
else
  echo "    swiftc missing: run 'xcode-select --install' in Terminal"
fi
echo
echo "Done. Press “Refresh” in ClaudeStarter."
echo
read -n 1 -s -r -p "Press any key to close..."
