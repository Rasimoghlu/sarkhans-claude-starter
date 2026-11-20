import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const name = process.argv[2] || "";
const projectDir = resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
if (!/^[a-z-]+$/.test(name) || existsSync(join(projectDir, ".claude", "starter-version"))) process.exit(0);
process.env.STARTER_HOOK_NAME = name;
await import(`./${name}.mjs`);
