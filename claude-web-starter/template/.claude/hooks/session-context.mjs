import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readInput, loadConfig, projectDir, currentBranch, detectStacks, dockerSettings } from "./lib.mjs";

const input = await readInput();
const config = loadConfig();

const branch = currentBranch();
const onProtected = (config.protectedBranches || ["main", "master"]).includes(branch);
const version = existsSync(join(projectDir, ".claude", "starter-version"))
  ? readFileSync(join(projectDir, ".claude", "starter-version"), "utf8").trim()
  : "?";

const stacks = detectStacks();
function phaseLines() {
  const phase = config.projectPhase || "existing";
  const designMode = config.designMode || (phase === "new" ? "open" : "locked");
  const kickoffDone = existsSync(join(projectDir, ".claude", "KICKOFF.md"));
  const out = [];
  if (phase === "new" && !kickoffDone) out.push("NEW PROJECT — KICKOFF FIRST: run /kickoff and plan with the user before any code (code edits are blocked until .claude/KICKOFF.md exists). Choose and install the fitting design skill as part of the kickoff.");
  else if (phase === "new") out.push("NEW PROJECT — follow the decisions in .claude/KICKOFF.md (scope, design direction, chosen design skill) for every task.");
  out.push(designMode === "locked"
    ? "DESIGN LOCKED: this is an existing project — never change its visual design (colors, fonts, spacing, layout, component styles) unless the user asks; reuse existing styles; report design issues instead of fixing them."
    : "DESIGN OPEN: follow the agreed design direction and the installed design skill.");
  return out;
}
const MODES = {
  balanced: `MODE balanced: make small changes yourself (up to ${config.directEditMaxFiles ?? 3} code files per request); run /orchestrate for bigger work.`,
  strict: "MODE strict: never edit code yourself — every change goes through /orchestrate and the specialist agents.",
  advisory: "MODE advisory: no hook limits on direct edits; use agents when they clearly help.",
};
const mode = config.orchestratorMode || "balanced";
const lines = [
  `Starter v${version} active (stacks: ${stacks.join(", ") || "none detected"}). Rules: CLAUDE.md and .claude/rules/.`,
  `LANGUAGE: write everything for the user in ${config.responseLanguage || "English"}; code, commits, branches, PR text and report headings stay in English.`,
  MODES[mode] || MODES.balanced,
  ...phaseLines(),
];

const docker = dockerSettings();
if (docker) {
  const services = Object.entries(docker.services || {}).map(([stack, s]) => `${stack} → ${s.name}${s.workdir ? ` (${s.workdir})` : ""}`);
  lines.push(`DOCKER: this project runs in containers (${services.join(", ")}). Run project commands inside them: docker compose exec -T <service> <command>. Never down -v / volume rm / system prune.`);
}

if (onProtected) {
  lines.push(`WARNING: current branch is "${branch}". Create a feature branch (git switch -c <type>/<desc>) before the first commit.`);
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: lines.join("\n") },
}));
