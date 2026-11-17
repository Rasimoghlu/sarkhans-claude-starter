import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import {
  readInput, loadConfig, block, ok, projectDir, run, tail, readText,
  readPackageJson, detectPackageManager, findTool, pythonInterpreter, lastAssistantText, runStack,
} from "./lib.mjs";

const THIRD_EYE_HEADING = /#{2,4}\s*(Üçüncü göz|Ucuncu goz|Third eye)/i;
const AGENTS_HEADING = /#{2,4}\s*(Agentlər|Agentler|Agents)\b/i;
const SCHEMA_FILE = /(^|\/)(migrations|alembic\/versions|drizzle)\/.+\.(php|py|sql|ts|js|go)$|\.prisma$|(^|\/)models\.py$|(^|\/)(db\/)?schema\.(ts|js)$|\.sql$/;
const MAX_UNTRACKED_BYTES = 2_000_000;
const TIMEOUT = 170_000;

const input = await readInput();
const config = loadConfig();
if (!config.typecheckOnStop && !config.requireThirdEyeReport) ok();

const diff = run("git", ["diff", "HEAD"], { timeoutMs: 20_000 });
if (diff.code !== 0) ok();
const changedTracked = run("git", ["diff", "HEAD", "--name-only"], { timeoutMs: 20_000 }).out.split(/\r?\n/).filter(Boolean);
const untracked = run("git", ["ls-files", "--others", "--exclude-standard"], { timeoutMs: 20_000 }).out.split(/\r?\n/).filter(Boolean);

let untrackedContent = "";
for (const file of untracked) {
  if (untrackedContent.length > MAX_UNTRACKED_BYTES) break;
  try {
    untrackedContent += file + readFileSync(join(projectDir, file), "utf8");
  } catch {
    untrackedContent += file;
  }
}
if (!diff.out.trim() && !untrackedContent) ok();

const fingerprint = createHash("sha1").update(diff.out + untrackedContent).digest("hex");
const stateDir = join(tmpdir(), "claude-hooks");
mkdirSync(stateDir, { recursive: true });
const stateFile = join(stateDir, `stop-${createHash("sha1").update(projectDir).digest("hex").slice(0, 12)}.json`);
const session = input.session_id || "";

let state = { lastGreen: "", lastReported: "", session: "", retries: 0 };
try {
  state = { ...state, ...JSON.parse(readFileSync(stateFile, "utf8")) };
} catch {
  state = { ...state };
}
if (state.session !== session) state = { ...state, session, retries: 0 };
const save = () => writeFileSync(stateFile, JSON.stringify(state));

if (input.stop_hook_active && state.retries >= (config.maxStopRetries ?? 3)) {
  state.retries = 0;
  save();
  ok();
}

function fail(message) {
  state.retries += 1;
  save();
  block(message);
}

const changed = [...changedTracked, ...untracked].filter((f) => existsSync(join(projectDir, f)));
const byExt = (re) => changed.filter((f) => re.test(f) && !/^(node_modules|vendor|\.venv|venv)\//.test(f));

function typecheckTs() {
  if (!byExt(/\.(ts|tsx|mts|cts)$/).length || !existsSync(join(projectDir, "tsconfig.json"))) return null;
  const pkg = readPackageJson();
  if (pkg?.scripts?.typecheck) return run(detectPackageManager(), ["run", "typecheck"], { timeoutMs: TIMEOUT });
  const tsc = findTool("tsc", { localOnly: true });
  return tsc ? run(tsc, ["--noEmit", "--pretty", "false"], { timeoutMs: TIMEOUT }) : null;
}

function typecheckGo() {
  if (!byExt(/\.go$/).length || !existsSync(join(projectDir, "go.mod"))) return null;
  const spec = { host: findTool("go"), container: "go" };
  const build = runStack("go", spec, ["build", "./..."], { timeoutMs: TIMEOUT });
  if (build.code !== 0 || build.timedOut || build.skipped) return build;
  return runStack("go", spec, ["vet", "./..."], { timeoutMs: TIMEOUT });
}

function typecheckPhp() {
  const files = byExt(/\.php$/).filter((f) => !f.endsWith(".blade.php"));
  if (!files.length) return null;
  const hostPhp = findTool("php");
  for (const file of files) {
    const lint = runStack("php", { host: hostPhp, container: "php" }, ["-l", file], { timeoutMs: 30_000 });
    if (lint.code !== 0 || lint.skipped) return lint;
  }
  const phpstan = findTool("phpstan", { localOnly: true });
  if (!phpstan) return { code: 0, out: "" };
  return runStack("php", { host: hostPhp ? phpstan : null, container: "vendor/bin/phpstan" }, ["analyse", "--no-progress", "--error-format=raw", "--memory-limit=1G", ...files], { timeoutMs: TIMEOUT });
}

function typecheckPython() {
  const files = byExt(/\.py$/);
  if (!files.length) return null;
  const compile = runStack("python", { host: pythonInterpreter(), container: "python" }, ["-m", "py_compile", ...files], { timeoutMs: 60_000 });
  if (compile.code !== 0 || compile.skipped) return compile;
  const configuresMypy = /\[tool\.mypy\]/.test(readText("pyproject.toml")) || existsSync(join(projectDir, "mypy.ini"));
  if (!configuresMypy) return compile;
  return runStack("python", { host: findTool("mypy"), container: "mypy" }, ["--no-error-summary", ...files], { timeoutMs: TIMEOUT });
}

if (config.typecheckOnStop && state.lastGreen !== fingerprint) {
  const checks = [["TypeScript", typecheckTs], ["Go (build + vet)", typecheckGo], ["PHP (lint + PHPStan)", typecheckPhp], ["Python (compile + mypy)", typecheckPython]];
  for (const [label, check] of checks) {
    const result = check();
    if (result && !result.timedOut && !result.missing && !result.skipped && result.code !== 0) {
      fail(`stop-checks: ${label} errors exist after your changes. Fix them before finishing (no ignores, no casts to silence errors):\n${tail(result.out, 60)}`);
    }
  }
  state.lastGreen = fingerprint;
  save();
}

if (config.requireThirdEyeReport && state.lastReported !== fingerprint) {
  const text = lastAssistantText(input);
  if (text === null) ok();
  const missing = [];
  if ((config.orchestratorMode || "strict") === "strict" && !AGENTS_HEADING.test(text)) {
    missing.push(
      "### Agents\n" +
        "| Agent | Task | Result | How it was verified |\n" +
        "|---|---|---|---|\n" +
        "| <agent> | <slice> | ✅ / ❌ redone | <verifier result, commands + real output> |",
    );
  }
  const schemaChanged = changed.some((f) => SCHEMA_FILE.test(f));
  if (schemaChanged && (config.orchestratorMode || "strict") === "strict" && !/data-architect/i.test(text)) {
    missing.push(
      "Schema/migration files changed, so the `data-architect` agent must review them before you finish (normalization, FKs, indexes, constraints, types).\n" +
        "Run it, send its findings to db-engineer, then list it in the `### Agents` table with its verdict (APPROVE / CHANGES REQUESTED → fixed).",
    );
  }
  if (!THIRD_EYE_HEADING.test(text)) {
    missing.push(
      "### Third eye\n" +
        "- ✅ Found & fixed: <problem — file:line — what was changed>\n" +
        "- ⚠️ Found, not fixed: <problem — file:line — why not — proposed fix>\n" +
        "- 🔍 Not verified / risk: <what could not be verified>",
    );
  }
  if (missing.length) {
    fail(
      "stop-checks: code changed but your final report is incomplete. End your reply with:\n\n" +
        missing.join("\n\n") +
        "\n\nOnly list what really happened. If nothing was found, write `No problems found` and what you checked.",
    );
  }
  state.lastReported = fingerprint;
  state.retries = 0;
  save();
}

ok();
