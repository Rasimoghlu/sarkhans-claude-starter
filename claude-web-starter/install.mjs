#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync, appendFileSync, statSync, rmSync, renameSync, cpSync, mkdtempSync } from "node:fs";
import { join, resolve, dirname, relative, basename } from "node:path";
import { homedir, tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { detectOtherStacks, isStaticSite, commandText } from "./template/.claude/hooks/stacks.mjs";
import { NO_TEAM, PRESETS, readStarterSettings, saveStarterSettings, canonical, readTeam, teamHash, knownTeamFolders, teamChoice, teamLabel, rememberTeam, chooseProjectTeam, describeTeam } from "./template/.claude/hooks/team.mjs";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const force = args.includes("--force");
const privateMode = !args.includes("--shared");
const overwriteClaudeMd = args.includes("--overwrite-claude-md");
const VERSION = readFileSync(join(here, "VERSION"), "utf8").trim();
const uninstall = args.includes("--uninstall");
const USAGE = `Usage: node install.mjs <project-dir> [--force] [--shared] [--overwrite-claude-md]
       node install.mjs <project-dir> --uninstall

By default an install does everything inside the project, hidden from git (private).
Nothing is written to ~/.claude, so projects without the starter are not affected.

  --force                update template files in .claude/ (CLAUDE.md is kept)
  --shared               commit-able install: don't hide CLAUDE.md and .claude/ from git
  --overwrite-claude-md  also replace an existing project CLAUDE.md
  --uninstall            remove the starter from the project (CLAUDE.md is kept as CLAUDE.md.bak)
  --list-skills          show the skill/MCP catalog (✔ = installed in <project-dir>)
  --language <name>      language Claude uses for explanations and reports (default English)
  --phase new|existing   set the project phase (new → /kickoff first; existing → design locked)
  --design locked|open   lock or unlock the visual design for Claude
  --preset lite|standard|strict  how much the hooks steer Claude (default standard)
  --add-skill <id>       install a catalog skill/MCP into the project
  --remove-skill <id>    remove it again
  --no-recommended       don't add the recommended skills/MCP on a first install
  --register-skill <src> add your own skill to the catalog (GitHub owner/repo, GitHub URL or local folder)
  --pick <name>          with --register-skill: which skill to take when the source has several
  --unregister-skill <id> remove one of your own skills from the catalog
  --rules-hash           print the fingerprint of the rules this starter installs

Team rules (a folder with rules/*.md and an optional team.json: name, preset, responseLanguage, skills):
  --teams                       show the teams on this computer and which projects use which
  --set-team <folder>           default team: every project uses it unless it has its own choice
  --clear-team                  no default team
  --add-team <folder>           remember a team without making it the default
  --remove-team <folder>        forget a team (the folder itself is not touched)
  <project-dir> --team <folder> this project uses this team, then updates the project
  <project-dir> --no-team       this project uses no team
  <project-dir> --default-team  this project follows the default team again`;

if (args.includes("--help") || args.includes("-h")) {
  console.log(USAGE);
  process.exit(0);
}
const FLAG_VALUES = new Set(["--set-team", "--add-team", "--remove-team", "--team", "--add-skill", "--remove-skill", "--phase", "--design", "--language", "--preset", "--register-skill", "--pick", "--unregister-skill"]);
const target = args.find((a, i) => !a.startsWith("--") && !FLAG_VALUES.has(args[i - 1]));

const log = (s) => console.log(s);

const OBSOLETE_FILES = [
  "hooks/stop-typecheck.mjs",
  "rules/agents.md",
  "rules/skills.md",
  "rules/git.md",
  "rules/principles.md",
  "agents/verifier.md",
  "agents/code-reviewer.md",
];
const LEGACY_CLAUDE_MD = /\n## 0\. [^\n]+\n(?=[\s\S]*\n## 1\. YOU ARE MY THIRD EYE)/;
const LEGACY_CLAUDE_MD_END = "Stack-specific rules live in `.claude/rules/` (they load automatically for matching files).";
const STARTER_CLAUDE_MD_LINE = "The working rules, agents and skills live in `.claude/` and load automatically.";

const GLOBAL_BEGIN = "<!-- claude-starter:begin -->";
const GLOBAL_END = "<!-- claude-starter:end -->";

const LEGACY_GLOBAL_BLOCK = /^# Personal defaults \(all projects\)\n(?:(?!# )[^\n]*(?:\n|$))*/gm;
const LEGACY_GLOBAL_SIGNATURE = "## You are my third eye";

function removeLegacyGlobalRules() {
  const dest = join(homedir(), ".claude", "CLAUDE.md");
  if (!existsSync(dest)) return;
  const current = readFileSync(dest, "utf8").replace(/\r\n/g, "\n");
  const next = current
    .replace(new RegExp(`\\n*${GLOBAL_BEGIN}[\\s\\S]*?${GLOBAL_END}\\n*`, "g"), "\n\n")
    .replace(LEGACY_GLOBAL_BLOCK, (block) => (block.includes(LEGACY_GLOBAL_SIGNATURE) ? "" : block))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (next === current.trim()) return;
  writeFileSync(`${dest}.starter-backup`, current);
  if (next) writeFileSync(dest, `${next}\n`);
  else rmSync(dest);
  log("✔ Removed the starter's old global rules from ~/.claude/CLAUDE.md (backup: ~/.claude/CLAUDE.md.starter-backup) — the rules now apply only to projects with the starter installed");
}

function baseRulesHash() {
  const hash = createHash("sha256");
  const sources = ["template", "packs"]
    .flatMap((dir) => listFiles(join(here, dir)).map((file) => join(dir, file)))
    .filter((file) => !file.endsWith(".DS_Store"));
  for (const file of [...sources, "install.mjs"].sort()) {
    hash.update(file.split("\\").join("/"));
    hash.update("\0");
    hash.update(readFileSync(join(here, file)));
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 16);
}

function projectRulesHash(team) {
  return team ? `${baseRulesHash()}-${teamHash(team)}` : baseRulesHash();
}

function loadTeamOrExit(value, flag) {
  const folder = value && !value.startsWith("--") ? canonical(value.replace(/^~(?=$|[\\/])/, homedir())) : null;
  let team = null;
  try {
    team = readTeam(folder);
  } catch (error) {
    console.error(`✖ ${error.message}`);
    process.exit(1);
  }
  if (!team) {
    console.error(`✖ ${folder ? `${folder} is not a team folder.` : `Use ${flag} <folder>.`} A team folder has a team.json, a rules/ folder with .md files, or both.`);
    process.exit(1);
  }
  return team;
}

const TEAM_COMMANDS = ["--set-team", "--clear-team", "--add-team", "--remove-team", "--teams"];
if (TEAM_COMMANDS.some((flag) => args.includes(flag))) {
  const settings = readStarterSettings();
  const valueOf = (flag) => args[args.indexOf(flag) + 1];
  if (args.includes("--teams")) {
    const folders = knownTeamFolders(settings);
    if (!folders.length) {
      log("No teams on this computer yet. Add one with: node install.mjs --add-team <folder>");
      process.exit(0);
    }
    log("Teams on this computer:");
    for (const folder of folders) {
      let team = null;
      try {
        team = readTeam(folder);
      } catch {
        team = null;
      }
      const label = team ? describeTeam(team) : "(folder not found or not a team folder)";
      log(`  ${folder === settings.teamFolder ? "★" : " "} ${label}  ${folder}`);
    }
    log(settings.teamFolder ? "  ★ = default team: every project uses it unless it has its own choice." : "  No default team: projects use a team only when you choose one for them.");
    const own = Object.entries(settings.projectTeams || {});
    if (own.length) {
      log("Projects with their own choice:");
      for (const [project, folder] of own) log(`  ${project} → ${folder === NO_TEAM ? "no team" : folder}`);
    }
    process.exit(0);
  }
  if (args.includes("--clear-team")) {
    delete settings.teamFolder;
    log("✔ No default team any more. Projects with their own team keep it; the others drop team rules on their next update.");
  } else if (args.includes("--remove-team")) {
    const folder = canonical(String(valueOf("--remove-team") || "").replace(/^~(?=$|[\\/])/, homedir()));
    if (!knownTeamFolders(settings).includes(folder)) {
      console.error(`✖ ${folder} is not one of the teams on this computer. See them with: node install.mjs --teams`);
      process.exit(1);
    }
    settings.teams = knownTeamFolders(settings).filter((known) => known !== folder);
    if (settings.teamFolder === folder) delete settings.teamFolder;
    const affected = Object.entries(settings.projectTeams || {}).filter(([, chosen]) => chosen === folder).map(([project]) => project);
    for (const project of affected) delete settings.projectTeams[project];
    log(`✔ Removed the team in ${folder} from this computer.${affected.length ? ` ${affected.length} project(s) that used it now follow the default team.` : ""} The folder itself is not touched.`);
  } else {
    const flag = args.includes("--set-team") ? "--set-team" : "--add-team";
    const team = loadTeamOrExit(valueOf(flag), flag);
    rememberTeam(settings, team.folder);
    if (flag === "--set-team") {
      settings.teamFolder = team.folder;
      log(`✔ Default team: ${describeTeam(team)}. Every project uses it unless you choose another team for that project. Projects get it on their next update.`);
    } else {
      log(`✔ Added team ${describeTeam(team)}. Use it in a project with: node install.mjs <project> --team ${team.folder}`);
    }
  }
  saveStarterSettings(settings);
  process.exit(0);
}

const PROJECT_TEAM_FLAGS = ["--team", "--no-team", "--default-team"];
const projectTeamFlag = PROJECT_TEAM_FLAGS.find((flag) => args.includes(flag));
if (projectTeamFlag && !target) {
  console.error(`✖ ${projectTeamFlag} works on one project: node install.mjs <project> ${projectTeamFlag}${projectTeamFlag === "--team" ? " <folder>" : ""}. For every project at once use --set-team <folder>.`);
  process.exit(1);
}
if (projectTeamFlag) {
  const settings = readStarterSettings();
  if (projectTeamFlag === "--team") {
    const team = loadTeamOrExit(args[args.indexOf("--team") + 1], "--team");
    rememberTeam(settings, team.folder);
    chooseProjectTeam(settings, target, team.folder);
  } else {
    chooseProjectTeam(settings, target, projectTeamFlag === "--no-team" ? NO_TEAM : null);
  }
  saveStarterSettings(settings);
}

if (args.includes("--rules-hash")) {
  const settings = readStarterSettings();
  const teams = {};
  for (const folder of knownTeamFolders(settings)) {
    try {
      const team = readTeam(folder);
      if (team) teams[folder] = teamHash(team);
    } catch {
      continue;
    }
  }
  console.log(JSON.stringify({ base: baseRulesHash(), teams }));
  process.exit(0);
}

const catalogOnly = args.includes("--register-skill") || args.includes("--unregister-skill");
if (!target && !catalogOnly) {
  console.error(USAGE);
  process.exit(1);
}

const root = resolve(target || ".");

function packStacks() {
  return readdirSync(join(here, "packs"), { withFileTypes: true }).filter((entry) => entry.isDirectory() && existsSync(join(here, "packs", entry.name, "rules"))).map((entry) => entry.name);
}

function firstHeading(file) {
  try {
    return readFileSync(file, "utf8").match(/^# .*$/m)?.[0] || null;
  } catch {
    return null;
  }
}

function isStarterPackRule(file) {
  const name = basename(file);
  const heading = firstHeading(file);
  return Boolean(heading) && packStacks().some((stack) => existsSync(join(here, "packs", stack, "rules", name)) && firstHeading(join(here, "packs", stack, "rules", name)) === heading);
}

function listFiles(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [relative(base, full)];
  });
}

function removeEmptyDirs(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return;
  for (const entry of readdirSync(dir)) removeEmptyDirs(join(dir, entry));
  if (readdirSync(dir).length === 0) rmSync(dir, { recursive: true });
}

function removeEntries(file, entries, header) {
  if (!existsSync(file)) return false;
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  const kept = lines.filter((line) => !entries.includes(line) && line !== header);
  if (kept.length === lines.length) return false;
  writeFileSync(file, kept.join("\n").replace(/\n{3,}/g, "\n\n"));
  return true;
}

function runUninstall() {
  if (!existsSync(root)) {
    console.error(`Folder not found: ${root}`);
    process.exit(1);
  }
  const claudeDir = join(root, ".claude");
  const packRules = packStacks().flatMap((stack) => listFiles(join(here, "packs", stack, "rules")).map((f) => join("rules", f)));
  const managed = [...new Set([...listFiles(join(here, "template", ".claude")), ...packRules, "starter-version", "starter-hash", ...OBSOLETE_FILES])];
  const teamRules = existsSync(join(claudeDir, "rules")) ? readdirSync(join(claudeDir, "rules")).filter((file) => file.startsWith("team-")).map((file) => join("rules", file)) : [];
  const packRuleSet = new Set(packRules);
  const removed = [...managed, ...teamRules].filter((file) => existsSync(join(claudeDir, file)) && (!packRuleSet.has(file) || isStarterPackRule(join(claudeDir, file))));
  removed.forEach((file) => rmSync(join(claudeDir, file), { force: true }));
  for (const id of installedCatalogIds(root)) {
    const item = catalog.find((entry) => entry.id === id);
    if (item) removeCatalogItem(root, item);
  }
  removeEmptyDirs(claudeDir);

  const notes = [];
  const claudeMd = join(root, "CLAUDE.md");
  const claudeMdText = existsSync(claudeMd) ? readFileSync(claudeMd, "utf8") : "";
  if (claudeMdText.includes(STARTER_CLAUDE_MD_LINE) || LEGACY_CLAUDE_MD.test(claudeMdText)) {
    renameSync(claudeMd, join(root, "CLAUDE.md.bak"));
    notes.push("CLAUDE.md → CLAUDE.md.bak (your project description is kept there)");
  }
  if (existsSync(join(root, "CLAUDE.starter.md"))) {
    rmSync(join(root, "CLAUDE.starter.md"));
    notes.push("removed CLAUDE.starter.md");
  }
  if (removeEntries(join(root, ".git", "info", "exclude"), ["CLAUDE.md", "CLAUDE.local.md", "CLAUDE.starter.md", ".claude/", "reports/"], "# local tooling")) {
    notes.push("cleaned .git/info/exclude");
  }
  const leftovers = existsSync(claudeDir) ? listFiles(claudeDir) : [];

  removeLegacyGlobalRules();
  log(`\n✔ Claude starter removed from ${root}`);
  log(`  Removed ${removed.length} starter files from .claude/`);
  notes.forEach((note) => log(`  ${note}`));
  if (leftovers.length) log(`  Kept your own files in .claude/: ${leftovers.join(", ")}`);
  log("");
}

const addSkillId = args[args.indexOf("--add-skill") + 1];
const removeSkillId = args[args.indexOf("--remove-skill") + 1];
const builtinCatalog = JSON.parse(readFileSync(join(here, "skills-catalog.json"), "utf8"));
const USER_CATALOG = join(homedir(), ".claude-starter", "my-skills.json");
const MY_SKILLS = "My skills";

function readUserCatalog() {
  try {
    const items = JSON.parse(readFileSync(USER_CATALOG, "utf8"));
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

const catalog = [
  ...builtinCatalog,
  ...readUserCatalog()
    .filter((item) => item?.id && item?.skill && !builtinCatalog.some((entry) => entry.id === item.id))
    .map((item) => ({ ...item, type: "skill", category: MY_SKILLS })),
];
const MARKER = ".catalog-source";
const clones = new Map();
process.on("exit", () => clones.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function cloneRepo(repo) {
  if (clones.has(repo)) return clones.get(repo);
  const tmp = mkdtempSync(join(tmpdir(), "claude-skill-"));
  const clone = spawnSync("git", ["clone", "--depth", "1", "--quiet", `https://github.com/${repo}.git`, tmp], { encoding: "utf8" });
  if (clone.status !== 0) {
    rmSync(tmp, { recursive: true, force: true });
    throw new Error(`git clone failed for ${repo}: ${(clone.stderr || clone.error?.message || "").trim()}`);
  }
  clones.set(repo, tmp);
  return tmp;
}

function frontmatterValue(text, key) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return "";
  const end = lines.indexOf("---", 1);
  const block = lines.slice(1, end === -1 ? lines.length : end);
  const index = block.findIndex((line) => line.startsWith(`${key}:`));
  if (index === -1) return "";
  let value = block[index].slice(key.length + 1).trim();
  if (value === "" || value === ">" || value === "|" || value === ">-" || value === "|-") {
    const continuation = [];
    for (const line of block.slice(index + 1)) {
      if (!/^\s+\S/.test(line)) break;
      continuation.push(line.trim());
    }
    value = continuation.join(" ");
  }
  return value.replace(/^["']|["']$/g, "").trim();
}

function collectSkills(dir, depth = 0, found = []) {
  if (depth > 6 || !existsSync(dir) || !statSync(dir).isDirectory()) return found;
  const skillFile = join(dir, "SKILL.md");
  if (existsSync(skillFile)) {
    const text = readFileSync(skillFile, "utf8");
    const name = (frontmatterValue(text, "name") || dir.split(/[\\/]/).pop()).replace(/[^\w.-]/g, "-");
    found.push({ name, description: frontmatterValue(text, "description"), dir });
    return found;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || [".git", "node_modules", ".github"].includes(entry.name)) continue;
    collectSkills(join(dir, entry.name), depth + 1, found);
  }
  return found;
}

function findSkillDir(dir, skillName, depth = 0) {
  if (depth > 6) return null;
  const skillFile = join(dir, "SKILL.md");
  if (existsSync(skillFile)) {
    const name = readFileSync(skillFile, "utf8").match(/^name:\s*["']?([^"'\n]+)/m)?.[1]?.trim();
    if (name === skillName) return dir;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || [".git", "node_modules", ".github"].includes(entry.name)) continue;
    const found = findSkillDir(join(dir, entry.name), skillName, depth + 1);
    if (found) return found;
  }
  return null;
}

function readMcp(rootDir) {
  try {
    return JSON.parse(readFileSync(join(rootDir, ".mcp.json"), "utf8"));
  } catch {
    return { mcpServers: {} };
  }
}

function addCatalogItem(rootDir, item) {
  if (item.type === "mcp") {
    const mcp = readMcp(rootDir);
    mcp.mcpServers = { ...(mcp.mcpServers || {}), [item.id]: item.server };
    writeFileSync(join(rootDir, ".mcp.json"), JSON.stringify(mcp, null, 2) + "\n");
    if (existsSync(join(rootDir, ".git"))) appendMissingLines(join(rootDir, ".git", "info", "exclude"), [".mcp.json"]);
    log(`✔ MCP "${item.id}" added to .mcp.json — Claude Code asks you to approve it on next start (check with /mcp).`);
    return;
  }
  let source;
  let origin;
  if (item.path) {
    source = existsSync(join(item.path, "SKILL.md")) ? item.path : existsSync(item.path) ? findSkillDir(item.path, item.skill) : null;
    if (!source) throw new Error(`skill "${item.skill}" not found in ${item.path} (folder moved or deleted?)`);
    origin = { path: item.path };
  } else {
    const tmp = cloneRepo(item.repo);
    source = item.repoPath && existsSync(join(tmp, item.repoPath, "SKILL.md")) ? join(tmp, item.repoPath) : findSkillDir(tmp, item.skill);
    if (!source) throw new Error(`skill "${item.skill}" not found in ${item.repo} (no SKILL.md with that name)`);
    origin = { repo: item.repo, commit: spawnSync("git", ["-C", tmp, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).stdout.trim() };
  }
  const dest = join(rootDir, ".claude", "skills", item.skill);
  rmSync(dest, { recursive: true, force: true });
  cpSync(source, dest, { recursive: true, filter: (src) => !src.split(/[\\/]/).includes(".git") });
  writeFileSync(join(dest, MARKER), JSON.stringify({ id: item.id, ...origin, installedAt: new Date().toISOString() }, null, 2) + "\n");
  const files = listFiles(dest);
  const scripts = files.filter((f) => /\.(py|sh|js|mjs|ts|rb)$/.test(f));
  const from = origin.repo ? `${origin.repo}@${origin.commit}` : origin.path;
  log(`✔ Skill "${item.skill}" installed from ${from} → .claude/skills/${item.skill} (${files.length} files)`);
  if (scripts.length) log(`  ⚠️ contains scripts: ${scripts.slice(0, 6).join(", ")}${scripts.length > 6 ? " …" : ""} — review before use`);
}

function removeCatalogItem(rootDir, item) {
  if (item.type === "mcp") {
    const mcp = readMcp(rootDir);
    if (mcp.mcpServers?.[item.id]) {
      delete mcp.mcpServers[item.id];
      if (Object.keys(mcp.mcpServers).length || Object.keys(mcp).length > 1) writeFileSync(join(rootDir, ".mcp.json"), JSON.stringify(mcp, null, 2) + "\n");
      else rmSync(join(rootDir, ".mcp.json"), { force: true });
    }
    log(`✔ MCP "${item.id}" removed`);
    return;
  }
  const dest = join(rootDir, ".claude", "skills", item.skill);
  if (existsSync(join(dest, MARKER))) rmSync(dest, { recursive: true, force: true });
  log(`✔ Skill "${item.skill}" removed`);
}

function installedCatalogIds(rootDir) {
  const mcp = readMcp(rootDir).mcpServers || {};
  return catalog.filter((item) => (item.type === "mcp" ? Boolean(mcp[item.id]) : existsSync(join(rootDir, ".claude", "skills", item.skill, MARKER)))).map((item) => item.id);
}

function appendMissingLines(file, entries) {
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  const missing = entries.filter((entry) => !text.split(/\r?\n/).includes(entry));
  if (missing.length) appendFileSync(file, `${text && !text.endsWith("\n") ? "\n" : ""}${missing.join("\n")}\n`);
}

function parseGitHubSource(source) {
  const match = source.trim().match(/^(?:https?:\/\/github\.com\/|git@github\.com:)?([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/(?:tree|blob)\/[^/]+\/(.+?))?\/?$/);
  if (!match) return null;
  return { repo: `${match[1]}/${match[2]}`, subdir: match[3]?.replace(/\/SKILL\.md$/, "") };
}

if (args.includes("--register-skill")) {
  const source = args[args.indexOf("--register-skill") + 1] || "";
  const pick = args.includes("--pick") ? args[args.indexOf("--pick") + 1] : null;
  const localPath = resolve(source.replace(/^~(?=$|[\\/])/, homedir()));
  let found;
  let origin;
  let cloneRoot = null;
  try {
    if (source && existsSync(localPath)) {
      found = collectSkills(localPath);
      origin = "local";
    } else {
      const github = parseGitHubSource(source);
      if (!github) throw new Error(`"${source}" is not a folder or a GitHub repository (owner/repo or https://github.com/owner/repo)`);
      const tmp = cloneRepo(github.repo);
      cloneRoot = tmp;
      found = collectSkills(github.subdir ? join(tmp, github.subdir) : tmp);
      origin = github.repo;
    }
  } catch (error) {
    console.error(`✖ ${error.message}`);
    process.exit(1);
  }
  if (!found.length) {
    console.error("✖ No SKILL.md found there. A skill is a folder with a SKILL.md file (name and description at the top).");
    process.exit(1);
  }
  if (!pick && found.length > 1) {
    console.log(JSON.stringify({ choices: found.map(({ name, description }) => ({ name, description })) }));
    process.exit(3);
  }
  const chosen = pick ? found.find((skill) => skill.name === pick) : found[0];
  if (!chosen) {
    console.error(`✖ "${pick}" not found. Available: ${found.map((skill) => skill.name).join(", ")}`);
    process.exit(1);
  }
  const id = builtinCatalog.some((entry) => entry.id === chosen.name) ? `my-${chosen.name}` : chosen.name;
  const entry = {
    id,
    type: "skill",
    category: MY_SKILLS,
    name: chosen.name,
    skill: chosen.name,
    description: chosen.description || "Your own skill.",
    ...(origin === "local" ? { path: chosen.dir } : { repo: origin, repoPath: relative(cloneRoot, chosen.dir) }),
  };
  const mine = readUserCatalog().filter((item) => item.id !== id);
  mkdirSync(dirname(USER_CATALOG), { recursive: true });
  writeFileSync(USER_CATALOG, JSON.stringify([...mine, entry], null, 2) + "\n");
  log(`✔ Added "${chosen.name}" to your skills (${origin === "local" ? chosen.dir : origin}). Turn it on per project.`);
  process.exit(0);
}

if (args.includes("--unregister-skill")) {
  const id = args[args.indexOf("--unregister-skill") + 1];
  const mine = readUserCatalog();
  if (!mine.some((item) => item.id === id)) {
    console.error(`✖ "${id}" is not one of your skills`);
    process.exit(1);
  }
  writeFileSync(USER_CATALOG, JSON.stringify(mine.filter((item) => item.id !== id), null, 2) + "\n");
  log(`✔ Removed "${id}" from your skills. Projects that already have it keep their copy until you switch it off there.`);
  process.exit(0);
}

if (args.includes("--list-skills")) {
  const installed = target && existsSync(resolve(target)) ? installedCatalogIds(resolve(target)) : [];
  for (const item of catalog) log(`${installed.includes(item.id) ? "✔" : " "} ${item.id.padEnd(28)} [${item.category}] ${item.name}`);
  process.exit(0);
}

if (args.includes("--add-skill") || args.includes("--remove-skill")) {
  const id = args.includes("--add-skill") ? addSkillId : removeSkillId;
  const item = catalog.find((entry) => entry.id === id);
  if (!item || !target) {
    console.error(`Unknown skill "${id}". Available: ${catalog.map((entry) => entry.id).join(", ")}`);
    process.exit(1);
  }
  const rootDir = resolve(target);
  if (!existsSync(join(rootDir, ".claude"))) {
    console.error(`Install the starter into ${rootDir} first.`);
    process.exit(1);
  }
  try {
    if (args.includes("--add-skill")) addCatalogItem(rootDir, item);
    else removeCatalogItem(rootDir, item);
  } catch (error) {
    console.error(`✖ ${error.message}`);
    process.exit(1);
  }
  process.exit(0);
}

function setProjectSettings(rootDir, settings) {
  const configPath = join(rootDir, ".claude", "hooks", "config.json");
  if (!existsSync(configPath)) {
    console.error(`Install the starter into ${rootDir} first.`);
    process.exit(1);
  }
  const current = JSON.parse(readFileSync(configPath, "utf8"));
  writeFileSync(configPath, JSON.stringify({ ...current, ...settings }, null, 2) + "\n");
}

const phaseFlag = args.includes("--phase") ? args[args.indexOf("--phase") + 1] : null;
const designFlag = args.includes("--design") ? args[args.indexOf("--design") + 1] : null;
const languageFlag = args.includes("--language") ? args[args.indexOf("--language") + 1] : null;
const presetFlag = args.includes("--preset") ? args[args.indexOf("--preset") + 1] : null;
if (presetFlag && !PRESETS[presetFlag]) {
  console.error("Use --preset lite|standard|strict");
  process.exit(1);
}
if (args.includes("--language") && (!languageFlag || languageFlag.startsWith("--"))) {
  console.error("Use --language <name>, e.g. --language English");
  process.exit(1);
}
if ((phaseFlag && !["new", "existing"].includes(phaseFlag)) || (designFlag && !["locked", "open"].includes(designFlag))) {
  console.error("Use --phase new|existing and --design locked|open");
  process.exit(1);
}
const settingsOnly = !projectTeamFlag && (phaseFlag || designFlag || languageFlag || presetFlag) && existsSync(join(resolve(target || "."), ".claude", "hooks", "config.json")) && !force;
if (settingsOnly) {
  const settings = {};
  if (phaseFlag) settings.projectPhase = phaseFlag;
  if (designFlag) settings.designMode = designFlag;
  else if (phaseFlag) settings.designMode = phaseFlag === "new" ? "open" : "locked";
  if (languageFlag) settings.responseLanguage = languageFlag;
  if (presetFlag) Object.assign(settings, PRESETS[presetFlag]);
  setProjectSettings(resolve(target), settings);
  log(`✔ ${resolve(target)}: ${Object.entries(settings).map(([key, value]) => `${key}=${value}`).join(" ")}`);
  process.exit(0);
}

if (uninstall) {
  runUninstall();
  process.exit(0);
}

const readJsonFile = (file) => {
  try {
    return JSON.parse(readFileSync(join(root, file), "utf8"));
  } catch {
    return null;
  }
};
const readTextFile = (file) => {
  try {
    return readFileSync(join(root, file), "utf8");
  } catch {
    return "";
  }
};
const fileExists = (file) => existsSync(join(root, file));
const which = (name) => spawnSync(process.platform === "win32" ? "where" : "which", [name], { encoding: "utf8" }).status === 0;

const stacks = [];
const stackLines = [];
const commandLines = [];
const packFiles = [];
const todo = [];
const pack = (stack, file) => {
  const entry = [join(here, "packs", stack, "rules", file), join(".claude", "rules", file)];
  if (!packFiles.some(([, dest]) => dest === entry[1])) packFiles.push(entry);
};
const OTHER_STACK_RULES = { rust: "rust.md", java: "java-kotlin.md", dotnet: "dotnet.md", ruby: "ruby.md", dart: "dart-flutter.md", swift: "swift.md" };

const pkg = readJsonFile("package.json");
const composer = readJsonFile("composer.json");
const goMod = readTextFile("go.mod");
const pythonMarkers = ["pyproject.toml", "requirements.txt", "setup.py", "Pipfile", "manage.py"];
const pythonText = ["pyproject.toml", "requirements.txt", "requirements-dev.txt", "requirements/base.txt", "Pipfile", "setup.py"].map(readTextFile).join("\n").toLowerCase();

if (pkg) {
  stacks.push("node");
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const has = (d) => Object.prototype.hasOwnProperty.call(deps, d);
  const version = (d) => (deps[d] ? ` ${String(deps[d]).replace(/^[^\d]*/, "")}` : "");
  const pm = fileExists("pnpm-lock.yaml") ? "pnpm" : fileExists("yarn.lock") ? "yarn" : fileExists("bun.lockb") || fileExists("bun.lock") ? "bun" : "npm";
  const runner = pm === "npm" || pm === "bun" ? `${pm} run` : pm;
  const isTs = has("typescript") || fileExists("tsconfig.json");
  const framework = has("next") ? `Next.js${version("next")} (App Router)` : has("nuxt") ? `Nuxt${version("nuxt")}` : has("@nestjs/core") ? "NestJS"
    : has("@remix-run/react") ? "Remix" : has("express") ? "Express" : has("vite") ? "Vite" : "Node.js";
  const ui = has("react") ? " + React" : has("vue") ? " + Vue" : has("svelte") ? " + Svelte" : "";
  const orm = has("drizzle-orm") ? "Drizzle" : has("@prisma/client") || has("prisma") ? "Prisma" : has("typeorm") ? "TypeORM" : null;
  const tests = [has("vitest") && "Vitest", has("jest") && "Jest", has("@playwright/test") && "Playwright"].filter(Boolean);
  stackLines.push(`- **${isTs ? "TypeScript" : "JavaScript"}**: ${framework}${ui}${has("tailwindcss") ? " · Tailwind" : ""}${orm ? ` · ${orm}` : ""} · tests: ${tests.join(", ") || "none yet"} · package manager: ${pm} (never mix lockfiles)`);
  for (const script of ["dev", "typecheck", "lint", "test", "build"]) {
    if (pkg.scripts?.[script]) commandLines.push(`- \`${runner} ${script}\``);
  }
  if (isTs) pack("node", "typescript.md");
  if (has("next")) pack("node", "nextjs-app-router.md");
  if (has("react")) pack("node", "react-components.md");
  if (isTs && !pkg.scripts?.typecheck) todo.push(`package.json: add "typecheck": "tsc --noEmit"`);
  if (!has("prettier") && (isTs || has("react"))) todo.push(`Prettier for auto-format on edit: ${pm} ${pm === "npm" ? "install -D" : "add -D"} prettier`);
}

if (goMod) {
  stacks.push("go");
  const moduleName = goMod.match(/^module\s+(\S+)/m)?.[1] || "";
  const goVersion = goMod.match(/^go\s+(\S+)/m)?.[1] || "";
  const req = (m) => goMod.includes(m);
  const http = req("github.com/gin-gonic/gin") ? "Gin" : req("github.com/labstack/echo") ? "Echo" : req("github.com/go-chi/chi") ? "chi"
    : req("github.com/gofiber/fiber") ? "Fiber" : "net/http";
  const db = req("gorm.io/gorm") ? "GORM" : req("github.com/jmoiron/sqlx") ? "sqlx" : req("github.com/jackc/pgx") ? "pgx" : req("entgo.io/ent") ? "ent" : null;
  stackLines.push(`- **Go ${goVersion}**: module \`${moduleName}\` · ${http}${db ? ` · ${db}` : ""}${req("github.com/stretchr/testify") ? " · testify" : ""}`);
  commandLines.push("- `go build ./...` · `go vet ./...` · `go test ./...`" + (which("golangci-lint") ? " · `golangci-lint run`" : ""));
  pack("go", "go.md");
  if (!which("golangci-lint")) todo.push("Go: install golangci-lint for /verify (brew install golangci-lint)");
}

if (composer) {
  stacks.push("php");
  const deps = { ...composer.require, ...composer["require-dev"] };
  const has = (d) => Object.prototype.hasOwnProperty.call(deps, d);
  const framework = has("laravel/framework") ? `Laravel ${String(deps["laravel/framework"]).replace(/^[^\d]*/, "")}` : has("symfony/framework-bundle") ? "Symfony" : "PHP";
  const tests = has("pestphp/pest") ? "Pest" : has("phpunit/phpunit") ? "PHPUnit" : "none yet";
  const analysis = has("larastan/larastan") || has("nunomaduro/larastan") ? "Larastan" : has("phpstan/phpstan") ? "PHPStan" : has("vimeo/psalm") ? "Psalm" : null;
  const style = has("laravel/pint") ? "Pint" : has("friendsofphp/php-cs-fixer") ? "PHP-CS-Fixer" : null;
  stackLines.push(`- **PHP ${String(deps.php || "").replace(/^[^\d]*/, "")}**: ${framework} · tests: ${tests}${analysis ? ` · ${analysis}` : ""}${style ? ` · ${style}` : ""}`);
  const testCmd = has("laravel/framework") ? "php artisan test" : has("pestphp/pest") ? "vendor/bin/pest" : "vendor/bin/phpunit";
  commandLines.push(`- \`${testCmd}\`` + (analysis ? " · `vendor/bin/phpstan analyse`" : "") + (style === "Pint" ? " · `vendor/bin/pint`" : style ? " · `vendor/bin/php-cs-fixer fix`" : ""));
  pack("php", "php.md");
  if (!analysis) todo.push("PHP: add static analysis (PHPStan/Larastan) — ask Claude to propose it, approve before install");
  if (!style) todo.push("PHP: add a formatter (Laravel Pint or PHP-CS-Fixer)");
}

if (pythonMarkers.some(fileExists)) {
  stacks.push("python");
  const has = (name) => new RegExp(`(^|[\\s"'\\[,])${name}([\\s"'<>=~!\\],;\\[]|$)`, "m").test(pythonText);
  const framework = has("django") || fileExists("manage.py") ? "Django" : has("fastapi") ? "FastAPI" : has("flask") ? "Flask" : "Python";
  const tools = [has("pytest") && "pytest", has("ruff") && "ruff", has("black") && "black", has("mypy") && "mypy"].filter(Boolean);
  const env = fileExists(".venv") ? ".venv" : fileExists("venv") ? "venv" : fileExists("uv.lock") ? "uv" : fileExists("poetry.lock") ? "poetry" : "system python";
  stackLines.push(`- **Python**: ${framework}${has("djangorestframework") ? " + DRF" : ""}${has("sqlalchemy") ? " · SQLAlchemy" : ""} · ${tools.join(", ") || "no tooling yet"} · env: ${env}`);
  commandLines.push("- `ruff check .` · `ruff format .` · `pytest`" + (has("mypy") ? " · `mypy .`" : "") + (framework === "Django" ? " · `python manage.py check`" : ""));
  pack("python", "python.md");
  if (!has("ruff") && !has("black")) todo.push("Python: add ruff (lint + format)");
}

function parseCompose(text) {
  const services = [];
  let inServices = false;
  let serviceIndent = null;
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || /^\s*#/.test(raw)) continue;
    const indent = raw.match(/^ */)[0].length;
    if (indent === 0) {
      inServices = /^services:\s*$/.test(raw);
      current = null;
      continue;
    }
    if (!inServices) continue;
    if (serviceIndent === null) serviceIndent = indent;
    if (indent === serviceIndent) {
      const name = raw.trim().match(/^["']?([\w.-]+)["']?:/)?.[1];
      current = name ? { name, block: "" } : null;
      if (current) services.push(current);
      continue;
    }
    if (current) current.block += raw.trim() + "\n";
  }
  return services.map((service) => {
    const block = service.block;
    const image = block.match(/^image:\s*["']?([^"'\s]+)/m)?.[1] || "";
    const buildContext = block.match(/^build:\s*["']?([^"'\s]+)/m)?.[1] || block.match(/^context:\s*["']?([^"'\s]+)/m)?.[1] || "";
    const dockerfileName = block.match(/^dockerfile:\s*["']?([^"'\s]+)/m)?.[1] || "Dockerfile";
    const dockerfile = buildContext ? readTextFile(join(buildContext, dockerfileName)) || readTextFile(dockerfileName) : "";
    const fromLines = [...dockerfile.matchAll(/^\s*FROM\s+(\S+)/gim)].map((m) => m[1]).join(" ");
    const shortMount = block.match(/^-\s*["']?(?:\.|\.\/|\$\{PWD\}|\$PWD)\/?:([^:"'\s]+)/m)?.[1];
    const longMount = /^source:\s*\.\/?\s*$/m.test(block) ? block.match(/^target:\s*["']?([^"'\s]+)/m)?.[1] : null;
    const workingDir = block.match(/^working_dir:\s*["']?([^"'\s]+)/m)?.[1];
    return { name: service.name, haystack: `${service.name} ${image} ${fromLines}`.toLowerCase(), image, workdir: workingDir || shortMount || longMount || null };
  });
}

const composeFile = ["compose.yaml", "compose.yml", "docker-compose.yml", "docker-compose.yaml"].find(fileExists);
const hasDockerfile = fileExists("Dockerfile") || readdirSync(root).some((f) => /^Dockerfile(\..+)?$/.test(f));
let dockerConfig = null;
if (composeFile || hasDockerfile) {
  pack("docker", "docker.md");
  stacks.push("docker");
}
if (composeFile) {
  const services = parseCompose(readTextFile(composeFile));
  const STACK_PATTERNS = {
    php: /php|laravel|sail|fpm|symfony|frankenphp/,
    python: /python|django|uvicorn|gunicorn|fastapi|flask/,
    go: /golang|(^|[\s/:-])go([\s:-]|$)/,
    node: /(^|[\s/:-])(node|bun|deno)([\s:-]|$)/,
  };
  const DB_PATTERN = /postgres|postgis|mysql|mariadb|mongo/;
  const mapped = {};
  for (const [stack, pattern] of Object.entries(STACK_PATTERNS)) {
    if (!stacks.includes(stack)) continue;
    const candidates = services.filter((s) => pattern.test(s.haystack));
    const chosen = candidates.find((s) => s.workdir) || candidates[0];
    if (chosen) mapped[stack] = { name: chosen.name, workdir: chosen.workdir };
  }
  const db = services.find((s) => DB_PATTERN.test(s.haystack));
  if (db) mapped.db = { name: db.name, engine: db.haystack.match(DB_PATTERN)[0] };
  dockerConfig = { enabled: true, composeFile, services: mapped };
  const parts = Object.entries(mapped).map(([stack, s]) => `\`${s.name}\` → ${stack === "db" ? s.engine : stack}${s.workdir ? ` (${s.workdir})` : ""}`);
  stackLines.push(`- **Docker** (${composeFile}): ${parts.join(", ") || "services: " + services.map((s) => s.name).join(", ")}`);
  const example = mapped.php ? `docker compose exec ${mapped.php.name} php artisan test` : mapped.python ? `docker compose exec ${mapped.python.name} python -m pytest` : mapped.go ? `docker compose exec ${mapped.go.name} go test ./...` : "docker compose exec <service> <command>";
  commandLines.push(`- Run project commands inside the containers, e.g. \`${example}\` (start with \`docker compose up -d\`)`);
  const unmapped = stacks.filter((s) => ["php", "python", "go"].includes(s) && !mapped[s]);
  if (unmapped.length) todo.push(`Docker: could not tell which compose service runs ${unmapped.join(", ")} — set it in .claude/hooks/config.json → docker.services`);
} else if (hasDockerfile) {
  stackLines.push("- **Docker**: Dockerfile (no compose file)");
}

const otherStacks = detectOtherStacks(root);
for (const other of otherStacks) {
  stackLines.push(`- **${other.label}**`);
  if (OTHER_STACK_RULES[other.id]) pack(other.id, OTHER_STACK_RULES[other.id]);
  if (other.commands.length) commandLines.push(`- ${other.commands.map(commandText).join(" · ")}`);
  else if (other.skipReason) commandLines.push(`- ${other.skipReason}`);
}
if (!stacks.some((s) => s !== "docker") && !otherStacks.length) {
  if (isStaticSite(root)) {
    stackLines.push("- **Static site** (HTML/CSS/JS)");
  } else {
    stackLines.push("- Not detected automatically. Read the project (README, build files, entry points) before changing code, then write the real stack here.");
  }
  commandLines.push("- No build or test commands detected. Find the project's own commands and add them here.");
}

const projectStacks = stacks.filter((s) => s !== "docker");
const projectName = pkg?.name || composer?.name || goMod.match(/^module\s+(\S+)/m)?.[1]?.split("/").pop()
  || readTextFile("pyproject.toml").match(/^name\s*=\s*["']([^"']+)/m)?.[1] || root.split(/[\\/]/).pop();

const copied = [], skipped = [];
const allPackRuleNames = new Set(packStacks().flatMap((stack) => listFiles(join(here, "packs", stack, "rules"))));
function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const s = join(src, entry), d = join(dest, entry);
    if (relative(join(here, "template", ".claude", "rules"), src) === "" && allPackRuleNames.has(entry)) continue;
    if (statSync(s).isDirectory()) copyDir(s, d);
    else if (existsSync(d) && !force) skipped.push(relative(root, d));
    else { copyFileSync(s, d); copied.push(relative(root, d)); }
  }
}
const previousConfigPath = join(root, ".claude", "hooks", "config.json");
let previousConfig = null;
try {
  previousConfig = JSON.parse(readFileSync(previousConfigPath, "utf8"));
} catch {
  previousConfig = null;
}

function detectPhase() {
  const commits = Number(spawnSync("git", ["rev-list", "--count", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim() || 0);
  const SKIP = new Set(["node_modules", "vendor", ".git", ".venv", "venv", "dist", "build", ".next", "storage", "bootstrap", "public", "coverage", ".claude", "target", "bin", "obj", ".build", "Pods", ".dart_tool"]);
  let files = 0;
  const walk = (dir, depth) => {
    if (depth > 6 || files > 400) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (/\.(tsx?|jsx?|vue|svelte|go|php|py|css|scss|html|twig|rs|java|kt|cs|fs|rb|erb|dart|swift)$/.test(entry.name)) files += 1;
    }
  };
  walk(root, 0);
  const isNew = commits > 0 ? commits <= 3 : files < 40;
  return { phase: isNew ? "new" : "existing", reason: commits > 0 ? `${commits} commit${commits === 1 ? "" : "s"}` : `${files} source files, no git history` };
}

const freshInstall = !existsSync(join(root, ".claude", "starter-version"));
copyDir(join(here, "template", ".claude"), join(root, ".claude"));
for (const [src, destRel] of packFiles) {
  const dest = join(root, destRel);
  if (existsSync(dest) && (!force || !isStarterPackRule(dest))) skipped.push(destRel);
  else {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    copied.push(destRel);
  }
}
const selectedRules = new Set(packFiles.map(([, destRel]) => destRel));
for (const name of allPackRuleNames) {
  const rel = join(".claude", "rules", name);
  if (!selectedRules.has(rel) && existsSync(join(root, rel)) && isStarterPackRule(join(root, rel))) rmSync(join(root, rel), { force: true });
}
for (const obsolete of OBSOLETE_FILES) {
  if (existsSync(join(root, ".claude", obsolete))) rmSync(join(root, ".claude", obsolete), { force: true });
}
const choice = teamChoice(readStarterSettings(), root);
let team = null;
try {
  team = readTeam(choice.folder);
  if (choice.folder && !team) todo.push(`Team folder not found: ${choice.folder}. Check that it's still there, or pick another team for this project (--team <folder>, --no-team).`);
} catch (error) {
  todo.push(`Team rules skipped: ${error.message}`);
}
const teamRuleNames = new Set((team?.rules || []).map((rule) => `team-${rule}`));
for (const rule of team?.rules || []) {
  copyFileSync(join(team.folder, "rules", rule), join(root, ".claude", "rules", `team-${rule}`));
}
for (const existing of readdirSync(join(root, ".claude", "rules"))) {
  if (existing.startsWith("team-") && !teamRuleNames.has(existing)) rmSync(join(root, ".claude", "rules", existing), { force: true });
}
writeFileSync(join(root, ".claude", "starter-version"), VERSION + "\n");
writeFileSync(join(root, ".claude", "starter-hash"), projectRulesHash(team) + "\n");
const projectConfigPath = join(root, ".claude", "hooks", "config.json");
let phaseNote = "";
try {
  const templateConfig = JSON.parse(readFileSync(projectConfigPath, "utf8"));
  const projectConfig = { ...templateConfig, ...(previousConfig || {}) };
  if (presetFlag) Object.assign(projectConfig, PRESETS[presetFlag]);
  else if (!previousConfig && PRESETS[team?.preset]) Object.assign(projectConfig, PRESETS[team.preset]);
  else if (previousConfig && !previousConfig.preset) Object.assign(projectConfig, previousConfig.orchestratorMode === "advisory" ? PRESETS.lite : PRESETS.standard);
  if (languageFlag) projectConfig.responseLanguage = languageFlag;
  else if (!previousConfig && team?.responseLanguage) projectConfig.responseLanguage = String(team.responseLanguage);
  if (team) projectConfig.team = team.name;
  else delete projectConfig.team;
  if (!projectConfig.responseLanguage) projectConfig.responseLanguage = "English";
  if (!previousConfig?.projectPhase || phaseFlag) {
    const detected = detectPhase();
    projectConfig.projectPhase = phaseFlag || detected.phase;
    projectConfig.designMode = designFlag || (projectConfig.projectPhase === "new" ? "open" : "locked");
    phaseNote = phaseFlag ? `phase: ${projectConfig.projectPhase} (set by flag)` : `phase: ${detected.phase} (${detected.reason})`;
  } else {
    if (designFlag) projectConfig.designMode = designFlag;
    phaseNote = `phase: ${projectConfig.projectPhase} (kept)`;
  }
  phaseNote += ` · language: ${projectConfig.responseLanguage} · preset: ${projectConfig.preset} · design: ${projectConfig.designMode}${projectConfig.projectPhase === "new" && !existsSync(join(root, ".claude", "KICKOFF.md")) ? " · run /kickoff first" : ""}`;
  if (dockerConfig) projectConfig.docker = { ...dockerConfig, services: { ...dockerConfig.services, ...(projectConfig.docker?.manualServices || {}) } };
  else delete projectConfig.docker;
  writeFileSync(projectConfigPath, JSON.stringify(projectConfig, null, 2) + "\n");
} catch {
  todo.push("Could not update .claude/hooks/config.json (invalid JSON?)");
}

const recommendedNotes = [];
if (freshInstall && !args.includes("--no-recommended")) {
  const deps = pkg ? { ...pkg.dependencies, ...pkg.devDependencies } : {};
  const usesReact = Boolean(deps.react || deps.next);
  const servesWebPages = Boolean(pkg) || fileExists("index.html") || fileExists("composer.json");
  const wanted = catalog.filter((item) =>
    item.recommended === "all" || (item.recommended === "frontend" && Boolean(pkg)) || (item.recommended === "react" && usesReact)
    || (item.recommended === "web" && servesWebPages)
    || (team?.skills || []).includes(item.id));
  for (const item of wanted) {
    try {
      addCatalogItem(root, item);
      recommendedNotes.push(item.id);
    } catch (error) {
      todo.push(`Recommended "${item.id}" couldn't be added (${error.message.split("\n")[0]}). Turn it on later in the app.`);
    }
  }
}

const hasAgentsMd = fileExists("AGENTS.md");
const agentsImport = hasAgentsMd ? "\n@AGENTS.md\n" : "";
const md = readFileSync(join(here, "template", "CLAUDE.md"), "utf8")
  .replace("<PROJECT_NAME>", projectName)
  .replace("<AGENTS_IMPORT>", agentsImport)
  .replace("<STACK_LINES>", stackLines.join("\n"))
  .replace("<COMMAND_LINES>", commandLines.join("\n"));

function withAgentsImport(text) {
  if (!hasAgentsMd || /^@AGENTS\.md\s*$/m.test(text)) return text;
  const [title, ...rest] = text.split("\n");
  return [title, "", "@AGENTS.md", ...rest].join("\n");
}

function migrateLegacyClaudeMd(text) {
  const header = text.slice(0, text.search(LEGACY_CLAUDE_MD)).replace(/\n---\s*$/, "").trimEnd()
    .split("\n").filter((line) => !/^- `\/(verify|ship|project-health|orchestrate)` — /.test(line)).join("\n").trimEnd();
  const endIndex = text.indexOf(LEGACY_CLAUDE_MD_END);
  const userTail = endIndex >= 0 ? text.slice(endIndex + LEGACY_CLAUDE_MD_END.length).trim() : "";
  return `${header}\n\n${STARTER_CLAUDE_MD_LINE}\n${userTail ? `\n${userTail}\n` : ""}`;
}

const claudeMd = join(root, "CLAUDE.md");
const currentClaudeMd = existsSync(claudeMd) ? readFileSync(claudeMd, "utf8") : null;
if (currentClaudeMd === null || overwriteClaudeMd) {
  writeFileSync(claudeMd, md);
  copied.push("CLAUDE.md");
} else if (LEGACY_CLAUDE_MD.test(currentClaudeMd)) {
  writeFileSync(join(root, ".claude", "CLAUDE.md.before-4.6"), currentClaudeMd);
  writeFileSync(claudeMd, withAgentsImport(migrateLegacyClaudeMd(currentClaudeMd)));
  copied.push("CLAUDE.md (slimmed: the rules now live in .claude/rules/core.md; old copy in .claude/CLAUDE.md.before-4.6)");
} else if (currentClaudeMd.includes(STARTER_CLAUDE_MD_LINE)) {
  const next = withAgentsImport(currentClaudeMd);
  if (next !== currentClaudeMd) {
    writeFileSync(claudeMd, next);
    copied.push("CLAUDE.md (now imports AGENTS.md)");
  }
} else {
  skipped.push("CLAUDE.md (yours, kept as is — the starter rules load from .claude/rules/)");
  if (hasAgentsMd && !/^@AGENTS\.md\s*$/m.test(currentClaudeMd)) {
    todo.push("AGENTS.md exists, but Claude reads only CLAUDE.md when both exist. Add a line `@AGENTS.md` to CLAUDE.md to use both");
  }
}
if (existsSync(join(root, "CLAUDE.starter.md"))) rmSync(join(root, "CLAUDE.starter.md"), { force: true });

function appendMissing(file, entries, header) {
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  const missing = entries.filter((entry) => !text.split(/\r?\n/).includes(entry));
  if (!missing.length) return;
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${text && !text.endsWith("\n") ? "\n" : ""}${text ? "\n" : ""}${header}\n${missing.join("\n")}\n`);
}
const hasGit = existsSync(join(root, ".git"));
if (privateMode && hasGit) {
  appendMissing(join(root, ".git", "info", "exclude"), ["CLAUDE.md", "CLAUDE.local.md", "CLAUDE.starter.md", ".claude/", "reports/"], "# local tooling");
} else {
  appendMissing(join(root, ".gitignore"), ["CLAUDE.local.md", ".claude/settings.local.json"], "# local");
}

log(`\n✔ Claude starter v${VERSION} installed into ${root}${privateMode && hasGit ? " (private: hidden from git)" : ""}`);
if (team || choice.source === "project") log(`  Team rules: ${teamLabel(team, choice)}${team ? `, ${team.rules.length} rule file${team.rules.length === 1 ? "" : "s"}` : ""}`);
removeLegacyGlobalRules();
log(`  Stacks: ${stacks.join(", ")}`);
if (phaseNote) log(`  Project ${phaseNote}`);
if (recommendedNotes.length) log(`  Recommended skills/tools added: ${recommendedNotes.join(", ")}`);
stackLines.forEach((line) => log(`  ${line.replace(/\*\*/g, "")}`));
log(`  Copied ${copied.length} files${skipped.length ? `, kept ${skipped.length} existing:` : "."}`);
skipped.forEach((s) => log(`    - ${s}`));

if (privateMode && hasGit) {
  const tracked = spawnSync("git", ["ls-files", "CLAUDE.md", ".claude"], { cwd: root, encoding: "utf8" }).stdout.trim();
  if (tracked) todo.push(`CLAUDE.md/.claude are already committed in this repo, so git still tracks them. To hide them: git rm -r --cached CLAUDE.md .claude && git commit`);
}
if (privateMode && !hasGit) todo.push(`No git repo yet: after git init, install again so CLAUDE.md and .claude/ are hidden from git`);
if (/<One sentence: what this app does/.test(existsSync(claudeMd) ? readFileSync(claudeMd, "utf8") : "")) {
  todo.push(`Open CLAUDE.md and fill in the one-line project description`);
}
if (!privateMode) todo.push(`Commit .claude/ and CLAUDE.md so the whole team gets the same rules`);
log(`\nNext steps:\n${todo.map((t, i) => `  ${i + 1}. ${t}`).join("\n")}\n`);
