#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STARTER = join(ROOT, "claude-web-starter");
const TEMPLATE = join(STARTER, "template", ".claude");
const PLUGIN_NAME = "sarkhans-starter";
const MARKETPLACE_NAME = "sarkhans-claude-starter";
const OUTPUT = join(ROOT, "plugins", PLUGIN_NAME);
const VERSION = readFileSync(join(STARTER, "VERSION"), "utf8").trim();
const DESCRIPTION = "Guardrails, rules, specialist agents and skills for professional work with Claude Code: third-eye reports, no invented APIs, safe git, design lock, database review.";
const SKILL_NAMES = readdirSync(join(TEMPLATE, "skills"));

function listFiles(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [relative(base, full)];
  });
}

function rewriteText(text) {
  const commands = new RegExp(`(^|[^\\w:/.-])/(${SKILL_NAMES.join("|")})\\b`, "g");
  return text
    .replaceAll("${CLAUDE_PROJECT_DIR}/.claude/scripts/", "${CLAUDE_PLUGIN_ROOT}/scripts/")
    .replaceAll(".claude/scripts/verify.mjs", "${CLAUDE_PLUGIN_ROOT}/scripts/verify.mjs")
    .replaceAll(".claude/rules/", "${CLAUDE_PLUGIN_ROOT}/rules/")
    .replace(commands, `$1/${PLUGIN_NAME}:$2`);
}

function copyTree(source, destination, transform) {
  for (const file of listFiles(source)) {
    if (file.endsWith(".DS_Store")) continue;
    const target = join(destination, file);
    mkdirSync(dirname(target), { recursive: true });
    if (transform && file.endsWith(".md")) writeFileSync(target, transform(readFileSync(join(source, file), "utf8")));
    else cpSync(join(source, file), target);
  }
}

function pluginHooks() {
  const settings = JSON.parse(readFileSync(join(TEMPLATE, "settings.json"), "utf8"));
  const rewrite = (command) => command.replace(
    /node "\$CLAUDE_PROJECT_DIR\/\.claude\/hooks\/([a-z-]+)\.mjs"/,
    (_, name) => `node "\${CLAUDE_PLUGIN_ROOT}/hooks/plugin-hook.mjs" ${name}`,
  );
  const hooks = Object.fromEntries(Object.entries(settings.hooks).map(([event, groups]) => [
    event,
    groups.map((group) => ({ ...group, hooks: group.hooks.map((hook) => ({ ...hook, command: rewrite(hook.command) })) })),
  ]));
  return { hooks };
}

function build(destination) {
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(join(destination, ".claude-plugin"), { recursive: true });
  writeFileSync(join(destination, ".claude-plugin", "plugin.json"), JSON.stringify({
    name: PLUGIN_NAME,
    version: VERSION,
    description: DESCRIPTION,
    author: { name: "sarkhandigitech" },
    homepage: "https://github.com/sarkhandigitech/sarkhans-claude-starter",
    repository: "https://github.com/sarkhandigitech/sarkhans-claude-starter",
    license: "MIT",
  }, null, 2) + "\n");
  copyTree(join(TEMPLATE, "skills"), join(destination, "skills"), rewriteText);
  copyTree(join(TEMPLATE, "agents"), join(destination, "agents"), rewriteText);
  copyTree(join(TEMPLATE, "rules"), join(destination, "rules"), rewriteText);
  for (const pack of readdirSync(join(STARTER, "packs"))) {
    const rules = join(STARTER, "packs", pack, "rules");
    if (existsSync(rules)) copyTree(rules, join(destination, "rules"), rewriteText);
  }
  copyTree(join(TEMPLATE, "hooks"), join(destination, "hooks"));
  copyTree(join(TEMPLATE, "scripts"), join(destination, "scripts"));
  cpSync(join(ROOT, "scripts", "plugin-files", "plugin-hook.mjs"), join(destination, "hooks", "plugin-hook.mjs"));
  cpSync(join(ROOT, "scripts", "plugin-files", "README.md"), join(destination, "README.md"));
  cpSync(join(ROOT, "scripts", "plugin-files", "icon.png"), join(destination, ".claude-plugin", "icon.png"));
  writeFileSync(join(destination, "hooks", "hooks.json"), JSON.stringify(pluginHooks(), null, 2) + "\n");
}

function marketplace() {
  return JSON.stringify({
    name: MARKETPLACE_NAME,
    description: "Sarkhans Claude Starter for Claude Code",
    owner: { name: "sarkhandigitech" },
    plugins: [{ name: PLUGIN_NAME, source: `./plugins/${PLUGIN_NAME}`, description: DESCRIPTION, version: VERSION }],
  }, null, 2) + "\n";
}

function snapshot(dir) {
  return existsSync(dir) ? listFiles(dir).sort().map((file) => `${file}\n${readFileSync(join(dir, file), "utf8")}`).join("\n\0") : "";
}

if (process.argv.includes("--check")) {
  const temporary = mkdtempSync(join(tmpdir(), "plugin-"));
  build(join(temporary, PLUGIN_NAME));
  const marketplacePath = join(ROOT, ".claude-plugin", "marketplace.json");
  const inSync = snapshot(join(temporary, PLUGIN_NAME)) === snapshot(OUTPUT)
    && existsSync(marketplacePath) && readFileSync(marketplacePath, "utf8") === marketplace();
  rmSync(temporary, { recursive: true, force: true });
  if (!inSync) {
    console.error("plugins/ is out of date. Run: node scripts/build-plugin.mjs");
    process.exit(1);
  }
  console.log("✔ plugin is in sync with the template");
} else {
  build(OUTPUT);
  mkdirSync(join(ROOT, ".claude-plugin"), { recursive: true });
  writeFileSync(join(ROOT, ".claude-plugin", "marketplace.json"), marketplace());
  console.log(`✔ Built plugins/${PLUGIN_NAME} ${VERSION} (${listFiles(OUTPUT).length} files)`);
}
