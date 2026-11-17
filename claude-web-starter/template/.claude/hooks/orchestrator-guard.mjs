import { isAbsolute, resolve, relative } from "node:path";
import { readInput, loadConfig, block, ok, relPath, projectDir } from "./lib.mjs";

const CODE_EXT = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|go|php|py|vue|svelte|css|scss|sass|less|sql|html|twig|json|ya?ml|toml|ini|sh|rb|rs|java|kt|swift|graphql|prisma)$/i;

const input = await readInput();
const config = loadConfig();
if ((config.orchestratorMode || "strict") !== "strict" || input.agent_id) ok();

const tool = input.tool_name || "";
const toolInput = input.tool_input || {};
const HOW = [
  "ADE: you are the Orchestrator — you don't change code yourself.",
  "Delegate this change with the Agent tool to the right specialist: backend-dev, frontend-dev, db-engineer, implementer or test-writer.",
  "Brief: goal + acceptance criteria, exact file scope, contracts, patterns to copy (file:line), rules, required `### Evidence`.",
  "Then supervise: check scope with git diff, re-check its evidence, run the verifier.",
  "(Only if the user explicitly asks you to edit directly: they can set \"orchestratorMode\": \"advisory\" in .claude/hooks/config.json.)",
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

if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
  const filePath = toolInput.file_path || toolInput.notebook_path || "";
  const rel = relPath(filePath) || filePath;
  if (/\.(md|mdx|txt)$/i.test(rel)) ok();
  block(`BLOCKED (orchestrator-guard): ${rel}\n${HOW}`);
}

if (tool === "Bash") {
  const command = String(toolInput.command || "");
  const reason = bashWriteTarget(command);
  if (reason) block(`BLOCKED (orchestrator-guard): \`${command.slice(0, 160)}\` — ${reason} from the main session.\n${HOW}`);
}

ok();
