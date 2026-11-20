#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INSTALLER="$ROOT/claude-web-starter/install.mjs"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export HOME="$WORK/home"
mkdir -p "$HOME"

fail() { echo "✖ $1" >&2; exit 1; }
pass() { echo "✔ $1"; }

for file in "$INSTALLER" "$ROOT"/claude-web-starter/template/.claude/hooks/*.mjs "$ROOT"/claude-web-starter/template/.claude/scripts/*.mjs; do
  node --check "$file"
done
pass "all scripts parse"

make_project() {
  mkdir -p "$WORK/$1"
  cd "$WORK/$1"
  git init -q
  echo '{"name":"'"$1"'","scripts":{"test":"vitest"},"devDependencies":{"typescript":"5"}}' > package.json
  echo '{}' > tsconfig.json
  git add . && git -c user.email=ci@example.com -c user.name=ci commit -qm init
  cd "$WORK"
}

make_project fresh
node "$INSTALLER" "$WORK/fresh" --no-recommended >/dev/null
[ -f "$WORK/fresh/.claude/rules/core.md" ] || fail "core.md missing"
grep -q "The working rules, agents and skills live in" "$WORK/fresh/CLAUDE.md" || fail "CLAUDE.md not written"
[ "$(node -p "require('$WORK/fresh/.claude/hooks/config.json').preset")" = "standard" ] || fail "default preset is not standard"
pass "fresh install"

make_project agents
echo "# Agent notes" > "$WORK/agents/AGENTS.md"
node "$INSTALLER" "$WORK/agents" --no-recommended >/dev/null
grep -qx "@AGENTS.md" "$WORK/agents/CLAUDE.md" || fail "AGENTS.md not imported"
pass "AGENTS.md import"

make_project own
printf "# Mine\n\nUse pnpm.\n" > "$WORK/own/CLAUDE.md"
node "$INSTALLER" "$WORK/own" --no-recommended >/dev/null
[ "$(cat "$WORK/own/CLAUDE.md")" = "$(printf "# Mine\n\nUse pnpm.")" ] || fail "user CLAUDE.md was changed"
node "$INSTALLER" "$WORK/own" --uninstall >/dev/null
[ -f "$WORK/own/CLAUDE.md" ] || fail "uninstall moved the user's CLAUDE.md"
pass "user CLAUDE.md untouched"

node "$INSTALLER" "$WORK/fresh" --preset strict >/dev/null
[ "$(node -p "require('$WORK/fresh/.claude/hooks/config.json').orchestratorMode")" = "strict" ] || fail "--preset strict not applied"
node "$INSTALLER" "$WORK/fresh" --preset standard >/dev/null
pass "presets"

export CLAUDE_PROJECT_DIR="$WORK/fresh"
HOOKS="$WORK/fresh/.claude/hooks"
guard() { echo "$1" | node "$HOOKS/orchestrator-guard.mjs" >/dev/null 2>&1 && echo 0 || echo $?; }
echo '{"prompt":"fix","session_id":"s"}' | node "$HOOKS/prompt-router.mjs" >/dev/null
for name in a b c; do
  [ "$(guard '{"session_id":"s","tool_name":"Edit","tool_input":{"file_path":"src/'$name'.ts"}}')" = 0 ] || fail "small direct edit blocked"
done
[ "$(guard '{"session_id":"s","tool_name":"Edit","tool_input":{"file_path":"src/d.ts"}}')" = 2 ] || fail "4th direct file not blocked"
[ "$(guard '{"session_id":"s","agent_id":"x","agent_type":"reviewer","tool_name":"Write","tool_input":{"file_path":"src/a.ts"}}')" = 2 ] || fail "reviewer could edit code"
[ "$(guard '{"session_id":"s","agent_id":"x","agent_type":"reviewer","tool_name":"Write","tool_input":{"file_path":".claude/agent-memory/reviewer/MEMORY.md"}}')" = 0 ] || fail "reviewer memory blocked"
pass "orchestrator guard"
