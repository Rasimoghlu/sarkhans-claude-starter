import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const STARTER_SETTINGS = join(homedir(), ".claude-starter", "settings.json");
export const NO_TEAM = "none";
export const PRESETS = {
  lite: { preset: "lite", orchestratorMode: "advisory", directEditMaxFiles: 3, reportMinChangedLines: 80, requireSubagentEvidence: false },
  standard: { preset: "standard", orchestratorMode: "balanced", directEditMaxFiles: 3, reportMinChangedLines: 30, requireSubagentEvidence: true },
  strict: { preset: "strict", orchestratorMode: "strict", directEditMaxFiles: 0, reportMinChangedLines: 0, requireSubagentEvidence: true },
};

export function readStarterSettings() {
  try {
    return JSON.parse(readFileSync(STARTER_SETTINGS, "utf8"));
  } catch {
    return {};
  }
}

export function saveStarterSettings(settings) {
  mkdirSync(dirname(STARTER_SETTINGS), { recursive: true });
  writeFileSync(STARTER_SETTINGS, JSON.stringify(settings, null, 2) + "\n");
}

export function canonical(path) {
  const absolute = resolve(path);
  try {
    return realpathSync(absolute);
  } catch {
    return absolute;
  }
}

export function readTeam(folder) {
  if (!folder || !existsSync(folder)) return null;
  const rulesDir = join(folder, "rules");
  const rules = existsSync(rulesDir) ? readdirSync(rulesDir).filter((file) => file.endsWith(".md")).sort() : [];
  let manifest = {};
  if (existsSync(join(folder, "team.json"))) {
    try {
      manifest = JSON.parse(readFileSync(join(folder, "team.json"), "utf8"));
    } catch {
      throw new Error(`${join(folder, "team.json")} is not valid JSON`);
    }
  } else if (!rules.length) {
    return null;
  }
  return {
    folder,
    name: String(manifest.name || folder.split(/[\\/]/).filter(Boolean).pop()),
    preset: manifest.preset,
    responseLanguage: manifest.responseLanguage,
    skills: Array.isArray(manifest.skills) ? manifest.skills.map(String) : [],
    files: [...(existsSync(join(folder, "team.json")) ? ["team.json"] : []), ...rules.map((rule) => join("rules", rule))],
    rules,
  };
}

export function teamHash(team) {
  const hash = createHash("sha256");
  for (const file of team.files) {
    hash.update(file.split("\\").join("/"));
    hash.update("\0");
    hash.update(readFileSync(join(team.folder, file)));
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 8);
}

export function knownTeamFolders(settings) {
  const folders = [...(Array.isArray(settings.teams) ? settings.teams : []), settings.teamFolder].filter(Boolean);
  return [...new Set(folders.map(String))];
}

export function teamChoice(settings, projectDir) {
  const own = (settings.projectTeams || {})[canonical(projectDir)];
  if (own === NO_TEAM) return { folder: null, source: "project" };
  if (own) return { folder: own, source: "project" };
  return { folder: settings.teamFolder || null, source: "default" };
}

export function teamLabel(team, choice) {
  if (!team) return choice.source === "project" ? "none (chosen for this project)" : "none";
  return `${team.name} (${choice.source === "project" ? "chosen for this project" : "default team"})`;
}

export function rememberTeam(settings, folder) {
  settings.teams = [...new Set([...knownTeamFolders(settings), folder])];
}

export function chooseProjectTeam(settings, projectDir, folder) {
  const key = canonical(projectDir);
  const choices = { ...(settings.projectTeams || {}) };
  if (folder) choices[key] = folder;
  else delete choices[key];
  if (Object.keys(choices).length) settings.projectTeams = choices;
  else delete settings.projectTeams;
}

export function describeTeam(team) {
  return `"${team.name}" (${team.rules.length} rule file${team.rules.length === 1 ? "" : "s"})`;
}

export function teamForProject(projectDir) {
  const choice = teamChoice(readStarterSettings(), projectDir);
  try {
    return { choice, team: readTeam(choice.folder), error: null };
  } catch (error) {
    return { choice, team: null, error: error.message };
  }
}

export function teamDefaults(team) {
  return {
    ...(PRESETS[team?.preset] || {}),
    ...(team?.responseLanguage ? { responseLanguage: String(team.responseLanguage) } : {}),
  };
}
