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

LOG="$WORK/fresh/.claude/logs/guardrails.jsonl"
echo '{"tool_name":"Read","tool_input":{"file_path":".env"}}' | node "$HOOKS/protect-files.mjs" >/dev/null 2>&1 || true
grep -q '"category":"secrets"' "$LOG" || fail "guardrail log missing the blocked .env read"
pass "guardrail log"

mkdir -p "$WORK/team/rules"
echo '{"name":"CI team","preset":"strict"}' > "$WORK/team/team.json"
echo "# Team rule" > "$WORK/team/rules/style.md"
before="$(node "$INSTALLER" --rules-hash)"
node "$INSTALLER" --set-team "$WORK/team" >/dev/null
[ "$(node "$INSTALLER" --rules-hash)" != "$before" ] || fail "team rules don't change the fingerprint"
make_project teamed
node "$INSTALLER" "$WORK/teamed" --no-recommended >/dev/null
[ -f "$WORK/teamed/.claude/rules/team-style.md" ] || fail "team rule not copied"
[ "$(node -p "require('$WORK/teamed/.claude/hooks/config.json').preset")" = "strict" ] || fail "team preset not applied to a new project"
node "$INSTALLER" --clear-team >/dev/null
node "$INSTALLER" "$WORK/teamed" --force >/dev/null
[ ! -f "$WORK/teamed/.claude/rules/team-style.md" ] || fail "team rule not removed after --clear-team"
pass "team rules"

mkdir -p "$WORK/team2/rules"
echo "# Second team rule" > "$WORK/team2/rules/naming.md"
node "$INSTALLER" --set-team "$WORK/team" >/dev/null
node "$INSTALLER" --add-team "$WORK/team2" >/dev/null
make_project own
node "$INSTALLER" "$WORK/own" --no-recommended --team "$WORK/team2" >/dev/null
[ -f "$WORK/own/.claude/rules/team-naming.md" ] && [ ! -f "$WORK/own/.claude/rules/team-style.md" ] || fail "project team not used instead of the default"
node "$INSTALLER" "$WORK/teamed" --force >/dev/null
[ -f "$WORK/teamed/.claude/rules/team-style.md" ] || fail "default team not used by a project without its own choice"
node "$INSTALLER" "$WORK/own" --no-team --force >/dev/null
ls "$WORK/own/.claude/rules" | grep -q '^team-' && fail "--no-team left team rules"
node "$INSTALLER" "$WORK/own" --default-team --force >/dev/null
[ -f "$WORK/own/.claude/rules/team-style.md" ] || fail "--default-team did not bring back the default team"
hashes="$(node "$INSTALLER" --rules-hash)"
expected="$(node -e 'const h=JSON.parse(process.argv[1]); console.log(h.base + "-" + h.teams[process.argv[2]])' "$hashes" "$(cd "$WORK/team" && pwd -P)")"
[ "$(cat "$WORK/own/.claude/starter-hash")" = "$expected" ] || fail "project fingerprint does not match base-team hash"
node "$INSTALLER" --teams | grep -q "CI team" || fail "--teams does not list the default team"
node "$INSTALLER" --remove-team "$WORK/team2" >/dev/null
node "$INSTALLER" --clear-team >/dev/null
pass "team per project"

PLUGIN="$ROOT/plugins/sarkhans-starter"
make_project plain
context="$(echo '{"source":"startup"}' | CLAUDE_PROJECT_DIR="$WORK/plain" CLAUDE_PLUGIN_ROOT="$PLUGIN" node "$PLUGIN/hooks/plugin-hook.mjs" session-context)"
echo "$context" | grep -q "Third eye" || fail "plugin session context lacks the core rules"
echo '{"source":"startup"}' | CLAUDE_PROJECT_DIR="$WORK/fresh" CLAUDE_PLUGIN_ROOT="$PLUGIN" node "$PLUGIN/hooks/plugin-hook.mjs" session-context | grep -q . && fail "plugin hooks ran in a project set up with the app"
pass "plugin hooks"

node "$PLUGIN/scripts/team.mjs" use "$WORK/team" --project "$WORK/plain" >/dev/null
context="$(echo '{"source":"startup"}' | CLAUDE_PROJECT_DIR="$WORK/plain" CLAUDE_PLUGIN_ROOT="$PLUGIN" node "$PLUGIN/hooks/plugin-hook.mjs" session-context)"
echo "$context" | grep -q "TEAM RULES — CI team" || fail "plugin does not load the project's team rules"
echo "$context" | grep -q "MODE strict" || fail "plugin does not apply the team's preset"
node "$PLUGIN/scripts/team.mjs" none --project "$WORK/plain" >/dev/null
echo '{"source":"startup"}' | CLAUDE_PROJECT_DIR="$WORK/plain" CLAUDE_PLUGIN_ROOT="$PLUGIN" node "$PLUGIN/hooks/plugin-hook.mjs" session-context | grep -q "TEAM RULES" && fail "plugin loads team rules after none"
node "$PLUGIN/scripts/team.mjs" use --project "$WORK/plain" >/dev/null 2>&1 && fail "team use without a folder did not fail"
pass "plugin team rules"
