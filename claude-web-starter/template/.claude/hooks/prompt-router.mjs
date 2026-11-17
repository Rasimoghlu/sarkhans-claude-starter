import { existsSync } from "node:fs";
import { join } from "node:path";
import { readInput, projectDir, loadConfig, readSessionState, writeSessionState, DESIGN_INTENT } from "./lib.mjs";

const input = await readInput();
const prompt = String(input.prompt || "").toLowerCase();
const config = loadConfig();
const designLocked = (config.designMode || (config.projectPhase === "new" ? "open" : "locked")) === "locked";
const designRequested = DESIGN_INTENT.test(prompt);
if (designLocked) {
  const previous = readSessionState("design");
  const unlocked = designRequested || (previous.session === input.session_id && Boolean(previous.unlocked));
  writeSessionState("design", { session: input.session_id, unlocked });
}
const designUnlockedEarlier = designLocked && !designRequested && readSessionState("design").unlocked;
const designLine = designLocked
  ? designRequested || designUnlockedEarlier
    ? "DESIGN: the user asked for a design change in this session — the design lock is open for exactly what was asked, nothing more."
    : "DESIGN LOCKED (existing project): do not change colors, fonts, spacing, layout or component styles; reuse existing classes/components; report design issues instead of fixing them."
  : "";
if (!prompt.trim() || prompt.trim().startsWith("/")) {
  if (designLine) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: designLine } }));
  process.exit(0);
}

const ROUTES = [
  ["kickoff", ["yeni layihə", "yeni layihe", "yeni proyekt", "new project", "kickoff", "sıfırdan", "sifirdan", "planlayaq", "müzakirə", "muzakire"]],
  ["orchestrate", ["böyük", "boyuk", "large", "bütün modul", "butun modul", "refactor", "refaktor", "migrate the", "rewrite", "yenidən yaz", "yeniden yaz", "çoxlu fayl", "coxlu fayl", "agent"]],
  ["write-tests", ["test yaz", "testlər yaz", "testler yaz", "write test", "unit test", "coverage", "regression test", "testləri", "testleri"]],
  ["ship", ["commit", "push", "pull request", "pr ", "ship", "merge", "göndər", "gonder", "yayımla", "deploy"]],
  ["db-change", ["migration", "miqrasiya", "schema", "sxem", "cədvəl", "cedvel", "column", "sütun", "sutun", "drizzle", "prisma", "database", "verilənlər bazası"]],
  ["add-api-route", ["api", "endpoint", "route handler", "server action", "webhook"]],
  ["new-feature", ["feature", "funksiya", "səhifə", "sehife", "page", "əlavə et", "elave et", "yarat", "implement", "form", "dashboard", "crud", "modul"]],
  ["security-audit", ["security", "təhlükəsiz", "tehlukesiz", "audit", "vulnerab", "zəiflik", "xss", "csrf", "injection"]],
  ["ui-review", ["ui", "ux", "dizayn", "design", "responsive", "a11y", "accessib", "görünüş", "gorunus", "mobil"]],
  ["project-health", ["health", "sağlamlıq", "saglamliq", "bütün layihə", "butun layihe", "whole project", "scan", "skan", "problemləri tap", "problemleri tap"]],
  ["verify", ["test", "yoxla", "verify", "lint", "typecheck", "build"]],
];

const matchesWord = (word) => new RegExp(`(^|[^\\p{L}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "iu").test(prompt);
const skillExists = (name) => existsSync(join(projectDir, ".claude", "skills", name, "SKILL.md"));
const matched = ROUTES.filter(([name, words]) => skillExists(name) && words.some(matchesWord)).map(([name]) => name).slice(0, 3);

const lines = [];
if (matched.length) {
  lines.push(`Matching skill(s) for this request: ${matched.map((m) => `/${m}`).join(", ")}. Use it as the playbook: follow it yourself for planning/verification and hand its implementation steps to the specialist agents.`);
}
lines.push(`Respond to the user in ${config.responseLanguage || "English"} (code, commits and report headings stay in English).`);
if (designLine) lines.push(designLine);
if (config.projectPhase === "new" && !existsSync(join(projectDir, ".claude", "KICKOFF.md"))) {
  lines.push("NEW PROJECT, NO KICKOFF YET: run /kickoff with the user before any code (code edits are blocked until .claude/KICKOFF.md exists).");
}
lines.push("ADE: you are the Orchestrator — plan, delegate code changes to specialist agents, supervise and verify them; never edit code yourself. Reminder: third eye (report + fix problems, end with `### Third eye` if code changed); SOLID/KISS/YAGNI/DRY; tests for every behaviour change; no comments; no hallucination; supervise any subagent output; never commit on main; no AI mentions in git.");

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: lines.join("\n") },
}));
