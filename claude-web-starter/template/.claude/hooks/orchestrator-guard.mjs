import { isAbsolute, resolve, relative } from "node:path";
import { readInput, loadConfig, block, ok, relPath, projectDir, readSessionState, writeSessionState } from "./lib.mjs";

const CODE_EXT = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|go|php|py|vue|svelte|css|scss|sass|less|sql|html|twig|json|ya?ml|toml|ini|sh|rb|rs|java|kt|swift|graphql|prisma)$/i;
const EDIT_TOOLS = ["Edit", "Write", "MultiEdit", "NotebookEdit"];
const READ_ONLY_AGENTS = {
  reviewer: [".claude/agent-memory/"],
  architect: [".claude/agent-memory/"],
  "data-architect": [".claude/agent-memory/"],
  "security-auditor": [".claude/agent-memory/", "reports/"],
};

const input = await readInput();
const config = loadConfig();
const tool = input.tool_name || "";
const toolInput = input.tool_input || {};
const editedPath = toolInput.file_path || toolInput.notebook_path || "";
const mode = config.orchestratorMode || "balanced";

if (input.agent_id) {
  const agentName = String(input.agent_type || "").split(":").pop();
  const allowed = READ_ONLY_AGENTS[agentName];
  if (allowed && EDIT_TOOLS.includes(tool)) {
    const rel = relPath(editedPath);
    if (!allowed.some((prefix) => rel.startsWith(prefix))) {
      block(`BLOCKED (orchestrator-guard): ${agentName} is read-only — it may write only ${allowed.join(" and ")}. Report the change as a finding instead.`);
    }
  }
  ok();
}
if (mode === "advisory") ok();

const HOW = [
  "Delegate it with the Agent tool to the right specialist (backend-dev, frontend-dev, db-engineer, implementer or test-writer), or run /orchestrate for the whole task.",
  "Brief: goal + acceptance criteria, exact file scope, contracts, patterns to copy (file:line), required `### Evidence`.",
  "Then supervise: check scope with git diff, re-check its evidence, run the reviewer.",
].join("\n");

function isProjectCodeFile(token) {
  const path = token.replace(/^["']|["']$/g, "");
  if (!CODE_EXT.test(path)) return false;
  const absolute = isAbsolute(path) ? path : resolve(projectDir, path);
  const rel = relative(projectDir, absolute);
  return !rel.startsWith("..") && !isAbsolute(rel);
}

function bashWriteTarget(command) {
  if (/(^|[\s;&|(])sed\s+(-[a-zA-Z]*i\b|--in-place)/.test(command) || /(^|[\s;&|(])perl\s+-[a-zA-Z]*i/.test(command)) return "in-place edit (sed -i / perl -i)";
  if (/\bgit\s+apply\b(?![^;&|]*--cached)/.test(command) || /\bgit\s+(am|stash\s+pop|cherry-pick|revert)\b/.test(command) || /(^|[\s;&|(])patch\s/.test(command)) return "applying a patch to the working tree";

  for (const match of command.matchAll(/(?:^|[^>&0-9])>{1,2}\s*("[^"]+"|'[^']+'|[^\s;&|)]+)/g)) {
    if (isProjectCodeFile(match[1])) return `redirect into ${match[1]}`;
  }
  for (const match of command.matchAll(/(?<![-\w])tee\s+(?:-a\s+)?("[^"]+"|'[^']+'|[^\s;&|)]+)/g)) {
    if (isProjectCodeFile(match[1])) return `tee into ${match[1]}`;
  }
  for (const segment of command.split(/(?:&&|\|\||;|\||\n)/)) {
    const words = segment.trim().split(/\s+/);
    const commandName = words[0] === "sudo" ? words[1] : words[0];
    if (["cp", "mv", "rm", "truncate", "touch", "ln"].includes(commandName)) {
      const target = words.slice(1).find((w) => !w.startsWith("-") && isProjectCodeFile(w));
      if (target) return `${commandName} ${target}`;
    }
  }
  return null;
}

function isDocument(rel) {
  return /\.(md|mdx|txt)$/i.test(rel);
}

if (mode === "strict") {
  if (EDIT_TOOLS.includes(tool)) {
    const rel = relPath(editedPath) || editedPath;
    if (isDocument(rel)) ok();
    block(`BLOCKED (orchestrator-guard, strict mode): ${rel}\nIn strict mode the main session doesn't change code itself.\n${HOW}`);
  }
  if (tool === "Bash") {
    const command = String(toolInput.command || "");
    const reason = bashWriteTarget(command);
    if (reason) block(`BLOCKED (orchestrator-guard, strict mode): \`${command.slice(0, 160)}\` — ${reason} from the main session.\n${HOW}`);
  }
  ok();
}

if (!EDIT_TOOLS.includes(tool)) ok();
const rel = relPath(editedPath);
if (!rel || isDocument(rel) || rel.startsWith(".claude/") || !CODE_EXT.test(rel)) ok();

const limit = Number(config.directEditMaxFiles ?? 3);
const state = readSessionState("direct-edits");
const files = state.session === input.session_id && Array.isArray(state.files) ? state.files : [];
if (files.includes(rel)) ok();
if (files.length >= limit) {
  block(
    `BLOCKED (orchestrator-guard): this request already changed ${files.length} code files directly (${files.join(", ")}); ${rel} would be one more.\n` +
      `It has grown beyond a small change (limit: directEditMaxFiles = ${limit}). Finish it with agents so it gets planned and reviewed:\n${HOW}`,
  );
}
writeSessionState("direct-edits", { session: input.session_id, files: [...files, rel] });
ok();
