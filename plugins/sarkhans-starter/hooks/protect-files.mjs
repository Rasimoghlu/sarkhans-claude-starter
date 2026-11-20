import { existsSync } from "node:fs";
import { basename } from "node:path";
import { readInput, loadConfig, block, ok, relPath } from "./lib.mjs";

const input = await readInput();
const config = loadConfig();
const tool = input.tool_name || "";
const toolInput = input.tool_input || {};
const filePath = toolInput.file_path || toolInput.notebook_path || toolInput.path || "";
if (!filePath) ok();

const name = basename(filePath);
if (tool !== "Read" && tool !== "Grep" && tool !== "Glob" && /claude-hooks[\\/]pentest-scope/.test(filePath)) {
  block("BLOCKED (protect-files): the pentest scope is changed only by .claude/scripts/pentest-scope.mjs, after the user has named the target.");
}
const rel = relPath(filePath);
const isWrite = tool !== "Read" && tool !== "Grep" && tool !== "Glob";

const SAFE_ENV = /^\.env\.(example|sample|template|defaults)$/i;
const isEnv = /^\.env(\..+)?$/i.test(name) && !SAFE_ENV.test(name);
const isKey = /\.(pem|key|p12|pfx|keystore|jks)$/i.test(name) || /^id_(rsa|ed25519|ecdsa)/.test(name);

if (config.blockSecretFiles && (isEnv || isKey)) {
  block(
    `BLOCKED (protect-files): "${name}" may contain secrets and is off-limits.\n` +
      `- To learn which env vars exist, read .env.example or src/env.ts.\n` +
      `- If a new env var is needed, add its NAME to .env.example and the env schema, then tell the user to set the value.`,
  );
}

if (!isWrite || !config.blockProtectedWrites) ok();

const LOCKFILES = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "bun.lock", "composer.lock", "go.sum", "poetry.lock", "uv.lock", "Pipfile.lock", "pdm.lock"]);
if (LOCKFILES.has(name)) {
  block(`BLOCKED (protect-files): never edit lockfiles by hand (${name}). Dependency changes need the user's approval and go through the package manager.`);
}

const isMigration =
  /(^|\/)(drizzle|migrations|prisma\/migrations|alembic\/versions)\/.+\.(sql|ts|js|php|py|go)$/.test(rel) &&
  !rel.includes("/meta/") && !/(^|\/)__init__\.py$/.test(rel);
if (isMigration && existsSync(filePath)) {
  block(`BLOCKED (protect-files): ${rel} is an existing migration. Applied migrations are immutable — create a new migration instead (/db-change).`);
}

if (/(^|\/)generated\/|\.generated\.[a-z]+$/.test(rel)) {
  block(`BLOCKED (protect-files): ${rel} is generated code. Change the source/schema and re-run the generator instead.`);
}

const protectedPrefixes = [
  [".git/", "Git internals are off-limits."],
  ["node_modules/", "Never patch node_modules. Fix it in project code or ask the user."],
  ["vendor/", "Never patch vendor/ dependencies. Fix it in project code or ask the user."],
  [".venv/", "Never edit the virtualenv."],
  ["venv/", "Never edit the virtualenv."],
  [".next/", "Build output — never edit."],
  [".claude/hooks/", "Enforcement hooks can only be changed by the user."],
  [".claude/settings.json", "Claude Code settings (permissions/hooks) can only be changed by the user."],
  [".claude/starter-version", "Managed by the installer."],
  [".claude/starter-hash", "Managed by the installer."],
  ...(config.extraProtectedPaths || []).map((p) => [p, "Protected by .claude/hooks/config.json."]),
];

for (const [prefix, why] of protectedPrefixes) {
  if (rel === prefix || rel.startsWith(prefix)) {
    block(`BLOCKED (protect-files): ${rel}\n${why}\nIf this change is really needed, explain why and ask the user to do it.`);
  }
}

ok();
