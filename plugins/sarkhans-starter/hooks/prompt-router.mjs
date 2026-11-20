import { existsSync } from "node:fs";
import { join } from "node:path";
import { readInput, projectDir, loadConfig, readSessionState, writeSessionState, DESIGN_INTENT } from "./lib.mjs";

const input = await readInput();
const prompt = String(input.prompt || "");
const config = loadConfig();

writeSessionState("direct-edits", { session: input.session_id, files: [] });

const designLocked = (config.designMode || (config.projectPhase === "new" ? "open" : "locked")) === "locked";
const lines = [];
if (designLocked) {
  const previous = readSessionState("design");
  const unlocked = DESIGN_INTENT.test(prompt) || (previous.session === input.session_id && Boolean(previous.unlocked));
  writeSessionState("design", { session: input.session_id, unlocked });
  lines.push(unlocked
    ? "Design: the user asked for a design change in this session — change exactly what was asked, nothing more."
    : "Design locked: don't change the visual design; reuse existing styles and report design issues instead.");
}
if (config.projectPhase === "new" && !existsSync(join(projectDir, ".claude", "KICKOFF.md"))) {
  lines.push("New project without a kickoff: run /kickoff with the user before any code.");
}
const language = config.responseLanguage || "English";
if (language !== "English") lines.push(`Reply in ${language}.`);

if (lines.length) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: lines.join("\n") } }));
}
