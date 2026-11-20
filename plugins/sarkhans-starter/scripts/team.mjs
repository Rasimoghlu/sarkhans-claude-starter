import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  NO_TEAM,
  canonical,
  chooseProjectTeam,
  describeTeam,
  knownTeamFolders,
  readStarterSettings,
  readTeam,
  rememberTeam,
  saveStarterSettings,
  teamForProject,
} from "../hooks/team.mjs";

const args = process.argv.slice(2);
const projectIndex = args.indexOf("--project");
const projectDir = canonical(projectIndex >= 0 && args[projectIndex + 1] ? args[projectIndex + 1] : process.cwd());
const [action = "status", value] = args.filter((arg, index) => index !== projectIndex && index !== projectIndex + 1);
const say = (text) => console.log(text);

function fail(text) {
  console.error(`✖ ${text}`);
  process.exit(1);
}

function folderFrom(input) {
  if (!input) fail(`Give the team folder, for example: ${action} ~/work/team-rules`);
  return canonical(input.replace(/^~(?=$|[\\/])/, homedir()));
}

function loadTeam(folder) {
  let team = null;
  try {
    team = readTeam(folder);
  } catch (error) {
    fail(error.message);
  }
  if (!team) fail(`${folder} is not a team folder. A team folder has a rules/ folder with .md files, a team.json, or both.`);
  return team;
}

function current() {
  const { choice, team, error } = teamForProject(projectDir);
  if (error) return `cannot be read (${error})`;
  if (!team) return choice.folder ? `the folder ${choice.folder} was not found` : choice.source === "project" ? "none (chosen for this project)" : "none";
  return `${describeTeam(team)} from ${team.folder}, ${choice.source === "project" ? "chosen for this project" : "the default team"}`;
}

function showStatus() {
  const settings = readStarterSettings();
  say(`Project: ${projectDir}`);
  say(`Team rules for this project: ${current()}`);
  const folders = knownTeamFolders(settings);
  say(folders.length ? "Teams on this computer (★ = default for every project):" : "No teams on this computer yet.");
  for (const folder of folders) {
    let team = null;
    try {
      team = readTeam(folder);
    } catch {
      team = null;
    }
    say(`  ${folder === settings.teamFolder ? "★" : "-"} ${team ? describeTeam(team) : "(not found)"}  ${folder}`);
  }
}

function save(settings, message) {
  saveStarterSettings(settings);
  say(`✔ ${message}`);
  say(`Team rules for this project now: ${current()}`);
  if (existsSync(join(projectDir, ".claude", "starter-version"))) {
    say("This project was set up with the Mac app or the installer, so its rules are files in .claude/rules/. The Mac app applies the change by itself; without the app, run the installer for this project again with --force.");
  } else {
    say("Start a new Claude Code session (or run /clear) to load the change.");
  }
}

const settings = readStarterSettings();
switch (action) {
  case "status":
    showStatus();
    break;
  case "use": {
    const team = loadTeam(folderFrom(value));
    rememberTeam(settings, team.folder);
    chooseProjectTeam(settings, projectDir, team.folder);
    save(settings, `This project uses the team ${describeTeam(team)}.`);
    break;
  }
  case "none":
    chooseProjectTeam(settings, projectDir, NO_TEAM);
    save(settings, "This project uses no team rules.");
    break;
  case "default":
    chooseProjectTeam(settings, projectDir, null);
    save(settings, "This project follows the default team again.");
    break;
  case "set-default": {
    const team = loadTeam(folderFrom(value));
    rememberTeam(settings, team.folder);
    settings.teamFolder = team.folder;
    save(settings, `Default team for every project on this computer: ${describeTeam(team)}. Projects with their own choice keep it.`);
    break;
  }
  case "clear-default":
    delete settings.teamFolder;
    save(settings, "No default team any more. Projects with their own choice keep it.");
    break;
  case "forget": {
    const folder = folderFrom(value);
    if (!knownTeamFolders(settings).includes(folder)) fail(`${folder} is not one of the teams on this computer.`);
    settings.teams = knownTeamFolders(settings).filter((known) => known !== folder);
    if (settings.teamFolder === folder) delete settings.teamFolder;
    for (const [project, chosen] of Object.entries(settings.projectTeams || {})) {
      if (chosen === folder) chooseProjectTeam(settings, project, null);
    }
    save(settings, `Forgot the team in ${folder}. The folder itself is not touched.`);
    break;
  }
  default:
    fail(`Unknown action "${action}". Use: status, use <folder>, none, default, set-default <folder>, clear-default, forget <folder>.`);
}
