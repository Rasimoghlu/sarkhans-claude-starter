import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readInput, loadConfig, projectDir, currentBranch, detectStacks, dockerSettings } from "./lib.mjs";
import { teamForProject } from "./team.mjs";

const input = await readInput();
const config = loadConfig();

const branch = currentBranch();
const onProtected = (config.protectedBranches || ["main", "master"]).includes(branch);
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || "";
const pluginMode = Boolean(pluginRoot) && !existsSync(join(projectDir, ".claude", "rules", "core.md"));
function pluginVersion() {
  try {
    return JSON.parse(readFileSync(join(pluginRoot, ".claude-plugin", "plugin.json"), "utf8")).version || "?";
  } catch {
    return "?";
  }
}
const version = existsSync(join(projectDir, ".claude", "starter-version"))
  ? readFileSync(join(projectDir, ".claude", "starter-version"), "utf8").trim()
  : pluginMode ? pluginVersion() : "?";

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
  `Starter v${version} active (stacks: ${stacks.join(", ") || "none detected"}). Rules: ${pluginMode ? "below" : "CLAUDE.md and .claude/rules/"}.`,
  `LANGUAGE: write everything for the user in ${config.responseLanguage || "English"}; code, commits, branches, PR text and report headings stay in English.`,
  MODES[mode] || MODES.balanced,
  ...phaseLines(),
];

if (pluginMode) {
  const rulesDir = join(pluginRoot, "rules");
  const core = readFileSync(join(rulesDir, "core.md"), "utf8").replace(/^---[\s\S]*?---\n/, "");
  const detailed = readdirSync(rulesDir).filter((file) => file.endsWith(".md") && file !== "core.md").join(", ");
  lines.push(
    "",
    core.trim(),
    "",
    `Detailed rules live in ${rulesDir}/ (${detailed}). Before editing a kind of file, read the matching ones: code-quality.md and testing.md for any code, security.md for servers and input handling, database.md for schema changes, design-policy.md and styling-and-a11y.md for UI, and the stack file for the language.`,
    "Skills of this plugin are namespaced: /sarkhans-starter:<name> (for example /sarkhans-starter:verify).",
  );
  lines.push(...teamLines());
}

function rulePaths(front) {
  const lines = front.split(/\r?\n/);
  const start = lines.findIndex((line) => /^paths:/.test(line));
  if (start < 0) return [];
  const clean = (value) => value.trim().replace(/^["']|["']$/g, "");
  const inline = lines[start].slice("paths:".length).trim();
  if (inline) return inline.replace(/^\[|\]$/g, "").split(",").map(clean).filter(Boolean);
  const items = [];
  for (const line of lines.slice(start + 1)) {
    const item = line.match(/^\s+-\s+(.+)$/);
    if (!item) break;
    items.push(clean(item[1]));
  }
  return items;
}

function teamLines() {
  const { choice, team, error } = teamForProject(projectDir);
  if (error) return ["", `TEAM RULES could not be loaded: ${error}. Tell the user once; /sarkhans-starter:team shows how to fix it.`];
  if (!team) return choice.folder ? ["", `TEAM RULES: the team folder ${choice.folder} was not found. Tell the user once; /sarkhans-starter:team shows how to fix it.`] : [];
  const rules = team.rules.map((rule) => {
    const text = readFileSync(join(team.folder, "rules", rule), "utf8");
    const front = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] || "";
    const scope = rulePaths(front);
    return `### ${rule}${scope.length ? ` (applies to files matching ${scope.join(", ")})` : ""}\n${text.replace(/^---[\s\S]*?---\r?\n/, "").trim()}`;
  });
  return [
    "",
    `TEAM RULES — ${team.name} (${choice.source === "project" ? "chosen for this project" : "default team"}). Your team agreed on these; follow them like the rules above.`,
    ...rules,
  ];
}

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
