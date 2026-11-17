import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readInput, loadConfig, projectDir, currentBranch, detectStacks, dockerSettings } from "./lib.mjs";

const input = await readInput();
const config = loadConfig();
const skillsDir = join(projectDir, ".claude", "skills");

function readSkill(dir) {
  const file = join(skillsDir, dir, "SKILL.md");
  if (!existsSync(file)) return null;
  const frontmatter = readFileSync(file, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) return null;
  const field = (key) => frontmatter[1].match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1].trim().replace(/^["']|["']$/g, "");
  const description = (field("description") || "").split(/(?<=\.)\s/)[0];
  return `- /${field("name") || dir} — ${description}`;
}

const skills = existsSync(skillsDir)
  ? readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => readSkill(d.name)).filter(Boolean)
  : [];

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
  out.push("");
  return out;
}
const lines = [
  `PROJECT RULES ACTIVE (stacks: ${stacks.join(", ") || "none detected"}; starter v${version}, session ${input.source || "startup"}). Re-read CLAUDE.md and .claude/rules/ before acting.`,
  "",
  `LANGUAGE: write every explanation, question, plan, progress note, report and summary for the user in ${config.responseLanguage || "English"} — subagents too, in the prose of their reports. Code, identifiers, comments-free code, commit messages, branch names, PR text and the report headings (### Agents, ### Third eye, ### Evidence) stay in English.`,
  ...phaseLines(),
  "MODE: Agentic Development Environment. You are the ORCHESTRATOR: you never edit code yourself (a hook blocks it).",
  "Every coding task: Explore → architect (plan + slices) → specialists in parallel (backend-dev, frontend-dev, db-engineer, implementer, test-writer) → verifier → code-reviewer/security-auditor → fix loop → report with `### Agents` + `### Third eye`.",
  "Agent output is a claim, not a fact: check scope (git diff), re-run their evidence, reject anything invented.",
  "",
  "Non-negotiable:",
  "- You are the user's THIRD EYE: report every problem you notice, fix safe ones along the way, ask before risky fixes. Every reply that changed code ends with a `### Third eye` section.",
  "- SOLID, KISS, YAGNI, DRY; design patterns only when the problem calls for them. Every behaviour change ships with tests you ran.",
  "- No comments in code, no `any`/`Any`, no loose comparisons, no swallowed errors, no debug output, no hardcoded secrets.",
  "- Never hallucinate APIs, packages, paths or results — verify in the repo / installed dependency / docs first. Say \"I don't know yet — let me check\" when unsure.",
  "- Never commit/push/merge on main/master; branch first. Never mention Claude/AI in commits, branches or PRs.",
  "",
  "SKILLS — before starting ANY task, check this list and use the matching skill (invoke it, or read .claude/skills/<name>/SKILL.md and follow it step by step):",
  ...skills,
];

const docker = dockerSettings();
if (docker) {
  const services = Object.entries(docker.services || {}).map(([stack, s]) => `${stack} → ${s.name}${s.workdir ? ` (${s.workdir})` : ""}`);
  lines.push("", `DOCKER: this project runs in containers (${services.join(", ")}). Run project commands inside them: docker compose exec -T <service> <command>. Never down -v / volume rm / system prune.`);
}

if (onProtected) {
  lines.push("", `WARNING: current branch is "${branch}". Create a feature branch (git switch -c <type>/<desc>) before the first commit.`);
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: lines.join("\n") },
}));
