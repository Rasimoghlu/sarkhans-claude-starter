import { existsSync } from "node:fs";
import { join } from "node:path";
import { readInput, loadConfig, block, ok, relPath, projectDir, readSessionState, STYLE_FILE } from "./lib.mjs";
import { languageOf } from "./languages.mjs";

const input = await readInput();
const config = loadConfig();
const tool = input.tool_name || "";
if (!["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) ok();

const toolInput = input.tool_input || {};
const filePath = toolInput.file_path || toolInput.notebook_path || "";
const rel = relPath(filePath);
if (!rel || rel.startsWith(".claude/")) ok();
const isDoc = /\.(md|mdx|txt)$/i.test(rel);

if (config.projectPhase === "new" && !existsSync(join(projectDir, ".claude", "KICKOFF.md")) && !isDoc) {
  const isCodeOrStyle = languageOf(filePath) !== null || STYLE_FILE.test(rel) || /\.(json|ya?ml|toml|html|vue|svelte|sql|prisma)$/i.test(rel);
  if (isCodeOrStyle) {
    block(
      `BLOCKED (design-guard): ${rel}\n` +
        "This is a NEW project and the kickoff has not happened yet. Run /kickoff: discuss goal, users, features, look & feel and constraints with the user, " +
        "agree on scope and design direction, pick the design skill, and write the decisions to .claude/KICKOFF.md. Code edits unlock after that.",
    );
  }
}

const designLocked = (config.designMode || (config.projectPhase === "new" ? "open" : "locked")) === "locked";
if (designLocked && STYLE_FILE.test(rel)) {
  const state = readSessionState("design");
  if (state.session !== input.session_id || !state.unlocked) {
    block(
      `BLOCKED (design-guard): ${rel} is a style/design file and the design of this existing project is LOCKED.\n` +
        "Do not change the visual design unless the user asked for it. Reuse the existing components, classes and tokens for functional UI work.\n" +
        "If a design change is really needed, describe it in the Third-eye section and ask the user — their next message asking for the design change unlocks it.",
    );
  }
}

ok();
