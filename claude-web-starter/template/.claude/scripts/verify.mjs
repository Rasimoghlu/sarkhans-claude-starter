import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  projectDir, readPackageJson, readJson, readText, detectPackageManager, detectStacks,
  findTool, pythonInterpreter, runStack, containerFor, dockerSettings,
} from "../hooks/lib.mjs";

const quick = process.argv.includes("--quick");
const stacks = detectStacks();
const steps = [];
const add = (stack, name, spec, args, { slow = false } = {}) => steps.push({ stack, name, spec, args, slow });
const skip = (stack, name, reason) => steps.push({ stack, name, reason });
const available = (stack, hostTool) => Boolean(hostTool || containerFor(stack));

const notes = [];

function requiredNodeMajor() {
  const fromFile = (readText(".nvmrc") || readText(".node-version")).trim().replace(/^v/, "");
  const fromEngines = String(readPackageJson()?.engines?.node || "");
  const source = fromFile || fromEngines;
  const major = source.match(/(\d+)/)?.[1];
  return major ? { major: Number(major), source: fromFile ? (readText(".nvmrc") ? ".nvmrc" : ".node-version") : "package.json engines" , raw: source } : null;
}

if (stacks.includes("node")) {
  const scripts = readPackageJson()?.scripts || {};
  const pm = findTool(detectPackageManager());
  const tsc = findTool("tsc", { localOnly: true });
  const required = requiredNodeMajor();
  const hostMajor = Number(process.versions.node.split(".")[0]);
  const hostMismatch = Boolean(required) && !new RegExp(`(^|[^\\d])${hostMajor}(\\D|$)`).test(required.raw) && !(/^>=?\s*\d+/.test(required.raw) && hostMajor >= required.major);
  const nodeContainer = containerFor("node");
  if (hostMismatch) {
    notes.push(nodeContainer
      ? `Node: host is v${process.versions.node}, project requires ${required.raw} (${required.source}) — node steps run in the "${nodeContainer.name}" container.`
      : `⚠️ Node: host is v${process.versions.node}, project requires ${required.raw} (${required.source}). Results can differ from CI. Use the required version (e.g. \`nvm use\`) or run inside a Node ${required.major} container.`);
  }
  const nodeSpec = { host: pm, container: detectPackageManager(), preferHost: !(hostMismatch && nodeContainer) };
  if (scripts.typecheck) add("node", "typecheck", nodeSpec, ["run", "typecheck"]);
  else if (tsc && existsSync(join(projectDir, "tsconfig.json"))) add("node", "typecheck", { host: tsc, container: null, preferHost: true }, ["--noEmit"]);
  if (scripts.lint) add("node", "lint", nodeSpec, ["run", "lint"]);
  if (scripts.test && !/no test specified/.test(scripts.test)) add("node", "test", nodeSpec, ["run", "test"]);
  else skip("node", "test", "no test script");
  if (scripts.build) add("node", "build", nodeSpec, ["run", "build"], { slow: true });
}

if (stacks.includes("go")) {
  const go = findTool("go");
  if (!available("go", go)) skip("go", "all", "go not installed on host and no running container");
  else {
    const spec = { host: go, container: "go" };
    add("go", "build", spec, ["build", "./..."]);
    add("go", "vet", spec, ["vet", "./..."]);
    const lint = findTool("golangci-lint");
    if (lint || containerFor("go")) add("go", "golangci-lint", { host: lint, container: "golangci-lint", preferHost: true }, ["run"]);
    else skip("go", "golangci-lint", "not installed");
    add("go", "test", spec, ["test", "./..."]);
  }
}

if (stacks.includes("php")) {
  const hostPhp = findTool("php");
  const viaHost = (bin) => (hostPhp ? bin : null);
  if (!available("php", hostPhp)) skip("php", "all", "php not installed on host and no running container");
  else {
    const composerScripts = readJson("composer.json")?.scripts || {};
    const phpstan = findTool("phpstan", { localOnly: true });
    const pint = findTool("pint", { localOnly: true });
    const fixer = findTool("php-cs-fixer", { localOnly: true });
    const pest = findTool("pest", { localOnly: true });
    const phpunit = findTool("phpunit", { localOnly: true });
    if (pint) add("php", "style", { host: viaHost(pint), container: "vendor/bin/pint" }, ["--test"]);
    else if (fixer) add("php", "style", { host: viaHost(fixer), container: "vendor/bin/php-cs-fixer" }, ["fix", "--dry-run", "--diff"]);
    if (phpstan) add("php", "phpstan", { host: viaHost(phpstan), container: "vendor/bin/phpstan" }, ["analyse", "--no-progress", "--memory-limit=1G"]);
    else skip("php", "static analysis", "phpstan not installed");
    if (existsSync(join(projectDir, "artisan"))) add("php", "test", { host: hostPhp, container: "php" }, ["artisan", "test"]);
    else if (composerScripts.test) add("php", "test", { host: findTool("composer"), container: "composer" }, ["test"]);
    else if (pest) add("php", "test", { host: viaHost(pest), container: "vendor/bin/pest" }, []);
    else if (phpunit) add("php", "test", { host: viaHost(phpunit), container: "vendor/bin/phpunit" }, []);
    else skip("php", "test", "no pest/phpunit");
  }
}

if (stacks.includes("python")) {
  const python = pythonInterpreter();
  if (!available("python", python)) skip("python", "all", "python not installed on host and no running container");
  else {
    const pySpec = { host: python, container: "python" };
    const ruff = findTool("ruff");
    const black = findTool("black");
    const pyproject = readText("pyproject.toml");
    if (ruff || containerFor("python")) {
      add("python", "ruff check", { host: ruff, container: "ruff", preferHost: true }, ["check", "."]);
      add("python", "format", { host: ruff, container: "ruff", preferHost: true }, ["format", "--check", "."]);
    } else if (black) add("python", "format", { host: black, container: "black", preferHost: true }, ["--check", "."]);
    if (/\[tool\.mypy\]/.test(pyproject) || existsSync(join(projectDir, "mypy.ini"))) add("python", "mypy", { host: findTool("mypy"), container: "mypy" }, ["."]);
    if (existsSync(join(projectDir, "manage.py"))) add("python", "django check", pySpec, ["manage.py", "check"]);
    const hasTests = existsSync(join(projectDir, "tests")) || readdirSync(projectDir).some((f) => /^test_.*\.py$/.test(f)) || /pytest/.test(pyproject);
    if (hasTests) add("python", "pytest", pySpec, ["-m", "pytest", "-q"]);
    else skip("python", "pytest", "no tests found");
  }
}

if (!stacks.length) {
  console.log("verify: no supported stack detected (package.json, go.mod, composer.json, pyproject.toml/requirements.txt).");
  process.exit(1);
}

const docker = dockerSettings();
if (docker) {
  const declared = Object.entries(docker.services || {}).filter(([stack]) => stacks.includes(stack));
  const down = declared.filter(([stack]) => !containerFor(stack)).map(([, s]) => s.name);
  if (down.length) console.log(`note: docker services not running (${down.join(", ")}) — using host tools where available. Start them with: docker compose up -d`);
}

const results = [];
let failed = false;
for (const step of steps) {
  const label = `${step.stack}:${step.name}`;
  if (step.reason) {
    results.push(`${label} ⏭️ ${step.reason}`);
    continue;
  }
  if (step.slow && (quick || failed)) {
    results.push(`${label} ⏭️ ${quick ? "skipped (--quick)" : "skipped (earlier step failed)"}`);
    continue;
  }
  process.stdout.write(`\n▶ ${label}: ${step.args.join(" ")}\n`);
  const started = Date.now();
  const r = runStack(step.stack, step.spec, step.args, { timeoutMs: 15 * 60 * 1000, env: { CI: "1", FORCE_COLOR: "0" } });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  const where = r.where && r.where !== "host" ? ` [${r.where}]` : "";
  if (r.skipped) {
    results.push(`${label} ⏭️ tool not available`);
  } else if (r.code === 0) {
    const summary = /test|pytest/.test(step.name) ? r.out.match(/(\d+\s+(tests?\s+)?passed[^\n]*|ok\s+\S+.*|OK \(\d+ tests?[^)]*\)|Tests:\s+\d+[^\n]*)/i)?.[1] ?? "" : "";
    results.push(`${label} ✅${where} ${summary ? `(${summary.trim().slice(0, 60)}) ` : ""}${secs}s`);
  } else {
    failed = true;
    const lines = r.out.trim().split(/\r?\n/);
    process.stdout.write((lines.length > 80 ? ["...", ...lines.slice(-80)] : lines).join("\n") + "\n");
    results.push(`${label} ❌${where} (exit ${r.timedOut ? "timeout" : r.code}) ${secs}s`);
  }
}

console.log(`\n==== VERIFY SUMMARY (${stacks.join(", ")}) ====\n${results.join("\n")}${notes.length ? `\n\n${notes.join("\n")}` : ""}`);
process.exit(failed ? 1 : 0);
