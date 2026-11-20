import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { join, resolve, relative, isAbsolute, sep } from "node:path";
import { spawnSync } from "node:child_process";

export const projectDir = resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());

const DEFAULT_CONFIG = {
  responseLanguage: "English",
  orchestratorMode: "balanced",
  directEditMaxFiles: 3,
  reportMinChangedLines: 30,
  blockSecretFiles: true,
  blockProtectedWrites: true,
  blockDangerousCommands: true,
  blockNewDependencies: true,
  enforceGitRules: true,
  protectedBranches: ["main", "master"],
  formatOnEdit: true,
  lintOnEdit: true,
  checkForbiddenPatterns: true,
  enforceCommentPolicy: true,
  checkImports: true,
  enforceEnvModule: true,
  maxNewFileLines: 400,
  typecheckOnStop: true,
  requireThirdEyeReport: true,
  requireSubagentEvidence: true,
  maxStopRetries: 3,
  extraProtectedPaths: [],
};

export function loadConfig() {
  const file = join(projectDir, ".claude", "hooks", "config.json");
  if (!existsSync(file)) return { ...DEFAULT_CONFIG };
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(file, "utf8")) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function readInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function block(message) {
  process.stderr.write(message.trim() + "\n");
  process.exit(2);
}

export function ok() {
  process.exit(0);
}

export function relPath(filePath) {
  if (!filePath) return "";
  const abs = isAbsolute(filePath) ? filePath : resolve(projectDir, filePath);
  const rel = relative(projectDir, abs);
  if (rel.startsWith("..")) return "";
  return rel.split(sep).join("/");
}

export function detectPackageManager() {
  if (existsSync(join(projectDir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(projectDir, "yarn.lock"))) return "yarn";
  if (existsSync(join(projectDir, "bun.lockb")) || existsSync(join(projectDir, "bun.lock"))) return "bun";
  return "npm";
}

export function readJson(file) {
  try {
    return JSON.parse(readFileSync(join(projectDir, file), "utf8"));
  } catch {
    return null;
  }
}

export function readPackageJson() {
  return readJson("package.json");
}

export function readText(file) {
  try {
    return readFileSync(join(projectDir, file), "utf8");
  } catch {
    return "";
  }
}

export function stripJsonComments(text) {
  return text
    .replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (match, str) => str ?? "")
    .replace(/,(\s*[}\]])/g, "$1");
}

export function readTsconfigPaths() {
  try {
    const raw = readFileSync(join(projectDir, "tsconfig.json"), "utf8");
    const opts = JSON.parse(stripJsonComments(raw)).compilerOptions || {};
    const baseUrl = resolve(projectDir, opts.baseUrl || ".");
    return Object.entries(opts.paths || {}).map(([alias, targets]) => ({
      prefix: alias.replace(/\*$/, ""),
      targets: targets.map((t) => resolve(baseUrl, t.replace(/\*$/, ""))),
    }));
  } catch {
    return [];
  }
}

const LOCAL_BIN_DIRS = [["node_modules", ".bin"], ["vendor", "bin"], [".venv", "bin"], ["venv", "bin"]];

export function findTool(name, { localOnly = false } = {}) {
  const isWin = process.platform === "win32";
  for (const parts of LOCAL_BIN_DIRS) {
    for (const candidate of isWin ? [`${name}.cmd`, `${name}.exe`, name] : [name]) {
      const p = join(projectDir, ...parts, candidate);
      if (existsSync(p)) return p;
    }
  }
  if (localOnly) return null;
  const lookup = spawnSync(isWin ? "where" : "which", [name], { encoding: "utf8" });
  const found = lookup.status === 0 ? lookup.stdout.split(/\r?\n/)[0].trim() : "";
  return found || null;
}

export function pythonInterpreter() {
  for (const dir of [".venv", "venv"]) {
    const p = join(projectDir, dir, process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
    if (existsSync(p)) return p;
  }
  return findTool("python3") || findTool("python");
}

export function localBin(name) {
  return findTool(name, { localOnly: true });
}

export function run(cmd, args, { timeoutMs = 120_000, env = {}, input } = {}) {
  const res = spawnSync(cmd, args, {
    cwd: projectDir,
    encoding: "utf8",
    timeout: timeoutMs,
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
    maxBuffer: 20 * 1024 * 1024,
    input,
  });
  return {
    code: res.status ?? (res.error ? 1 : 0),
    out: `${res.stdout || ""}${res.stderr || ""}`,
    timedOut: res.error?.code === "ETIMEDOUT",
    missing: res.error?.code === "ENOENT",
  };
}

let runningServicesCache = null;

export function dockerSettings() {
  const docker = loadConfig().docker;
  return docker && docker.enabled !== false ? docker : null;
}

export function runningServices() {
  if (runningServicesCache) return runningServicesCache;
  const docker = dockerSettings() && findTool("docker");
  if (!docker) return (runningServicesCache = new Set());
  const result = run(docker, ["compose", "ps", "--status", "running", "--services"], { timeoutMs: 15_000 });
  runningServicesCache = new Set(result.code === 0 ? result.out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : []);
  return runningServicesCache;
}

export function containerFor(stack) {
  const service = dockerSettings()?.services?.[stack];
  if (!service?.name || !runningServices().has(service.name)) return null;
  return service;
}

function toProjectRelative(arg) {
  if (typeof arg !== "string" || !isAbsolute(arg)) return arg;
  const rel = relative(projectDir, arg);
  return rel.startsWith("..") ? arg : rel.split(sep).join("/");
}

export function runStack(stack, spec, args, opts = {}) {
  const service = containerFor(stack);
  const inContainer = () => {
    if (!service || !spec.container) return null;
    const workdir = service.workdir ? ["-w", service.workdir] : [];
    const result = run(findTool("docker"), ["compose", "exec", "-T", ...workdir, service.name, spec.container, ...args.map(toProjectRelative)], opts);
    if (result.code === 126 || result.code === 127 || /executable file not found|OCI runtime exec failed|no such file or directory: unknown/i.test(result.out)) return null;
    return { ...result, where: `docker:${service.name}` };
  };
  const onHost = () => (spec.host ? { ...run(spec.host, args, opts), where: "host" } : null);
  const result = spec.preferHost ? onHost() || inContainer() : inContainer() || onHost();
  return result || { code: 0, out: "", skipped: true, where: "none" };
}

function sessionStateFile(name) {
  const dir = join(tmpdir(), "claude-hooks");
  mkdirSync(dir, { recursive: true });
  return join(dir, `${name}-${createHash("sha1").update(projectDir).digest("hex").slice(0, 12)}.json`);
}

export function readSessionState(name) {
  try {
    return JSON.parse(readFileSync(sessionStateFile(name), "utf8"));
  } catch {
    return {};
  }
}

export function writeSessionState(name, value) {
  writeFileSync(sessionStateFile(name), JSON.stringify(value));
}

export const DESIGN_INTENT = /(dizayn|design|redesign|restyle|stil|style|rəng|reng|colou?r|font|şrift|srift|tipoqraf|typograph|görünüş|gorunus|look and feel|layout|tema\b|theme|animasiya|animation|spacing|boşluq|bosluq|palitra|palette|brand|brend|icon|ikon|logo|dark mode|qaranlıq rejim|gözəlləşdir|gozellesdir|cilala|polish|ui-ı yenilə|ui-ı dəyiş)/i;

export const STYLE_FILE = /\.(css|scss|sass|less|styl|pcss)$|(^|\/)(tailwind|postcss|uno|windi)\.config\.[cm]?[jt]s$|(^|\/)(theme|themes|tokens|design-tokens|styles)(\/|\.[cm]?[jt]s$|\.json$)|(^|\/)components\/ui\/|(^|\/)resources\/(css|sass)\//i;

export function currentBranch() {
  const r = run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { timeoutMs: 5_000 });
  return r.code === 0 ? r.out.trim() : "";
}

export function detectStacks() {
  const stacks = [];
  const pkg = readPackageJson();
  if (pkg) stacks.push("node");
  if (existsSync(join(projectDir, "go.mod"))) stacks.push("go");
  if (existsSync(join(projectDir, "composer.json"))) stacks.push("php");
  if (["pyproject.toml", "requirements.txt", "setup.py", "Pipfile", "manage.py"].some((f) => existsSync(join(projectDir, f)))) stacks.push("python");
  return stacks;
}

export function tail(text, maxLines = 60) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length <= maxLines) return lines.join("\n");
  return [...lines.slice(0, maxLines), `... (${lines.length - maxLines} more lines)`].join("\n");
}

export function lastAssistantText(input, transcriptKey = "transcript_path") {
  if (typeof input.last_assistant_message === "string" && input.last_assistant_message) return input.last_assistant_message;
  const path = input[transcriptKey];
  if (!path || !existsSync(path)) return null;
  const lines = readFileSync(path, "utf8").trim().split(/\r?\n/);
  const texts = [];
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    const content = entry?.message?.content;
    if (entry.type === "user") {
      const isToolResult = Array.isArray(content) && content.every((c) => c?.type === "tool_result");
      if (!isToolResult) break;
      continue;
    }
    if (entry.type === "assistant" && Array.isArray(content)) {
      for (const part of content) if (part?.type === "text") texts.unshift(part.text);
    }
  }
  return texts.join("\n");
}

export const AI_MENTION = /\b(claude|anthropic|co-authored-by|generated with|generated by|llm|chatgpt|openai|copilot|ai[- ](generated|assisted|written))\b|🤖/i;

export const SECRET_PATTERNS = [
  [/\b(sk|rk)_(live|test)_[A-Za-z0-9]{16,}/, "Stripe secret key"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key"],
  [/-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY/, "private key"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{30,}/, "GitHub token"],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, "Google API key"],
  [/\bsk-(ant-|proj-)?[A-Za-z0-9_-]{32,}/, "AI provider API key"],
  [/\b(postgres(ql)?|mysql|mongodb(\+srv)?|redis|amqp):\/\/[^\s:@/]+:[^\s@/]+@/, "connection string with password"],
];
