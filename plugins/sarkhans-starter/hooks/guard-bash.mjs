import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readInput, loadConfig, block, ok, run, currentBranch, projectDir, AI_MENTION, readSessionState } from "./lib.mjs";
import { pentestBlock, SCOPE_STATE } from "./pentest.mjs";

const input = await readInput();
const config = loadConfig();
const command = String(input.tool_input?.command || "");
if (!command.trim()) ok();

const ASK = "If this is really needed, explain why and ask the user to run it themselves (they can type `! <command>` in Claude Code).";
const PROTECTED = config.protectedBranches || ["main", "master"];
const parts = command.split(/(?:&&|\|\||;|\n)/).map((s) => s.trim()).filter(Boolean);

const SECRET_FILE = /(^|[\s/'"])\.env(?!\.(example|sample|template|defaults)\b)(\.[\w.-]+)?(?=$|[\s'"])|\.(pem|key|p12|pfx)(?=$|[\s'"])/;

function checkRecursiveDelete(part) {
  const match = part.match(/(?:^|\s|\/)rm\s+(.+)$/);
  if (!match) return;
  const tokens = match[1].split(/\s+/);
  const flags = tokens.filter((t) => t.startsWith("-")).join(" ");
  const recursive = /(^|\s)-[a-zA-Z]*[rR]|--recursive/.test(flags);
  const force = /(^|\s)-[a-zA-Z]*f|--force/.test(flags);
  if (!(recursive && force)) return;
  const SAFE = /^(\.\/)?(node_modules|\.next|dist|build|out|coverage|\.turbo|\.cache|\.vercel\/output|playwright-report|test-results|storybook-static)(\/.*)?$/;
  const unsafe = tokens.filter((t) => !t.startsWith("-")).filter((t) => !SAFE.test(t.replace(/^["']|["']$/g, "")));
  if (unsafe.length) {
    block(`BLOCKED (guard-bash): \`rm -rf ${unsafe.join(" ")}\` — recursive force-delete is only allowed for build/cache folders (node_modules, .next, dist, coverage...). ${ASK}`);
  }
}

const RULES = [
  [/\bgit\s+push\b.*(\s--force(-with-lease)?\b|\s-f\b)/, "Force-push rewrites remote history."],
  [/\bgit\s+reset\s+--hard\b/, "`git reset --hard` destroys uncommitted work."],
  [/\bgit\s+clean\s+-[a-zA-Z]*f/, "`git clean -f` deletes untracked files permanently."],
  [/\bgit\s+(checkout|restore)\s+(--\s+)?\.(\s|$)/, "Discarding all local changes destroys uncommitted work."],
  [/\bgit\s+branch\s+-D\b/, "Force-deleting a branch can lose commits."],
  [/--no-verify\b/, "Skipping git hooks (--no-verify) bypasses the project's checks."],
  [/\bgit\s+add\b.*\s(-f|--force)\b/, "`git add -f` adds ignored files (often secrets or build output)."],
  [/\bgit\s+config\b.*\buser\.(name|email)\b/, "Never change the git identity."],
  [/\bgh\s+pr\s+merge\b/, "Merging PRs is the user's decision."],
  [/(^|\s)(cat|less|more|head|tail|bat|nl|strings|xxd|grep|rg|awk|sed|source|cp|mv|scp|\.)\s+[^|]*\.env(?!\.(example|sample|template|defaults))(\.[\w.-]+)?(\s|$)/, ".env files contain secrets."],
  [/\b(printenv|env)\s*($|\|)/, "Dumping the environment can leak secrets."],
  [/\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(sh|bash|zsh|node|python3?)\b/, "Piping a download into a shell runs untrusted code."],
  [/\b(npm|pnpm|yarn|bun)\s+publish\b/, "Publishing a package is a release decision for the user."],
  [/\b(npm|pnpm|yarn)\s+(install|i|add)\b.*\s(--force|--legacy-peer-deps)\b/, "Forced installs hide dependency conflicts."],
  [/(^|\s)sudo\s/, "sudo is not allowed."],
  [/\bchmod\s+(-R\s+)?777\b/, "chmod 777 is insecure."],
  [/\bprisma\s+migrate\s+reset\b/, "Resets the database and deletes all data."],
  [/\bprisma\s+db\s+push\b.*(--force-reset|--accept-data-loss)/, "Can delete data."],
  [/\bdrizzle-kit\s+(drop|push\b.*--force)/, "Can delete data / applied migrations."],
  [/\b(DROP\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE\s+TABLE?)\b/i, "Destructive SQL."],
  [/\bvercel\b.*\s--prod\b/, "Production deploys are done by the user."],
  [/\bartisan\s+(migrate:(fresh|reset|refresh|rollback)|db:wipe)\b/, "Destroys or rolls back database data."],
  [/\bdocker(-compose|\s+compose)\b.*\bdown\b.*(\s-v\b|--volumes)/, "`down -v` deletes the database volumes (all local data)."],
  [/\bdocker\s+(volume\s+(rm|prune)|system\s+prune|container\s+prune|image\s+prune\s+-a)\b/, "Deletes Docker volumes/containers/images (possibly database data)."],
  [/\bdocker(-compose|\s+compose)\b.*\brm\b.*(\s-v\b|--volumes)/, "Removes containers together with their volumes."],
  [/\bsail\s+(down\s+(-v|--volumes)|artisan\s+(migrate:(fresh|reset|refresh|rollback)|db:wipe))/, "Destroys database data."],
  [/\bmanage\.py\s+(flush|reset_db|sqlflush)\b/, "Deletes database data."],
  [/\balembic\s+downgrade\b/, "Rolls back database migrations."],
  [/\b(composer|pip|pip3|uv|poetry)\b.*\s--(ignore-platform-reqs|break-system-packages|no-deps)\b/, "Forced installs hide dependency conflicts."],
  [/\bgo\s+mod\s+vendor\b.*-e\b/, "Ignoring module errors hides broken dependencies."],
];

function checkDependencies(part) {
  if (/\bpip3?\s+install\s+(-r|--requirement|-e\s+\.|\.(\s|$)|--editable\s+\.)/.test(part)) return;
  const addsDependency =
    /\b(pnpm|yarn|bun)\s+add\s+(?:-\S+\s+)*[^-\s]\S*/.test(part) ||
    /\bnpm\s+(install|i|add)\s+(?:-\S+\s+)*[^-\s]\S*/.test(part) ||
    /\bgo\s+(get|install)\s+(?:-\S+\s+)*[^-\s.]\S*/.test(part) ||
    /\bcomposer\s+(require|req)\s+(?:-\S+\s+)*[^-\s]\S*/.test(part) ||
    /\b(pip|pip3|python3?\s+-m\s+pip)\s+install\s+(?:-\S+\s+)*[^-\s]\S*/.test(part) ||
    /\b(uv|poetry|pdm|pipenv)\s+(add|install)\s+(?:-\S+\s+)*[^-\s]\S*/.test(part);
  if (addsDependency) {
    block(
      `BLOCKED (guard-bash): \`${part}\`\n` +
        `Adding dependencies needs the user's approval. Tell the user which package, why, its size/maintenance, and alternatives. ` +
        `If they approve, they can run it themselves with \`! ${part}\`.`,
    );
  }
}

function readMessageFile(cmd) {
  const match = cmd.match(/\s(?:-F|--file)[=\s]+("[^"]+"|'[^']+'|\S+)/);
  if (!match) return "";
  try {
    return readFileSync(resolve(projectDir, match[1].replace(/^["']|["']$/g, "")), "utf8");
  } catch {
    return "";
  }
}

function checkGit() {
  const touchesHistory = /\bgit\s+(commit|tag|switch|checkout|branch|merge|push)\b|\bgh\s+(pr|release)\s+(create|edit|comment)\b/.test(command);
  if (!touchesHistory) return;

  const messageText = command + "\n" + readMessageFile(command);
  if (/\bgit\s+(commit|tag)\b|\bgh\s+(pr|release)\b|\bgit\s+(switch\s+(-c|--create)|checkout\s+-[bB]|branch\s+\S)/.test(command)) {
    const hit = messageText.match(AI_MENTION);
    if (hit) {
      block(
        `BLOCKED (guard-bash): the commit/branch/PR text mentions "${hit[0]}".\n` +
          `Never mention Claude, Claude Code, Anthropic, AI, LLMs, "generated" or Co-Authored-By trailers in commits, branches, tags or PRs. ` +
          `Rewrite it as a normal human-written message (e.g. "docs: update agent instructions" instead of naming the tool).`,
      );
    }
  }

  const branch = currentBranch();
  let branchCreated = false;
  for (const part of parts) {
    const created = part.match(/\bgit\s+(?:switch\s+(?:-c|--create)|checkout\s+-[bB])\s+(\S+)/);
    if (created) {
      if (PROTECTED.includes(created[1])) block(`BLOCKED (guard-bash): don't create or reset "${created[1]}". Use a feature branch like feat/<short-desc>.`);
      branchCreated = true;
      continue;
    }
    const onProtected = PROTECTED.includes(branch) && !branchCreated;

    if (/\bgit\s+commit\b/.test(part)) {
      if (onProtected) {
        block(`BLOCKED (guard-bash): you are on "${branch}". Never commit on ${PROTECTED.join("/")}. First create a branch: \`git switch -c <type>/<short-desc>\` (feat/, fix/, refactor/, perf/, security/, chore/).`);
      }
      const includeTracked = /\s(-a|--all|-am)\b/.test(part);
      const staged = run("git", ["diff", "--cached", "--name-only"], { timeoutMs: 10_000 }).out;
      const tracked = includeTracked ? run("git", ["diff", "--name-only"], { timeoutMs: 10_000 }).out : "";
      const secretFiles = (staged + "\n" + tracked).split(/\r?\n/).filter((f) => f && SECRET_FILE.test(" " + f));
      if (secretFiles.length) {
        block(`BLOCKED (guard-bash): secret files are staged: ${secretFiles.join(", ")}. Unstage them (\`git restore --staged <file>\`) and make sure they are in .gitignore.`);
      }
    }

    if (/\bgit\s+merge\b/.test(part) && onProtected) {
      block(`BLOCKED (guard-bash): never merge into ${branch}. Merging into protected branches happens through a reviewed PR, by the user.`);
    }

    const push = part.match(/\bgit\s+push\b(.*)$/);
    if (push) {
      const targetsProtected = PROTECTED.some((b) => new RegExp(`(^|[\\s:+])${b}(\\s|$)`).test(push[1]));
      if (onProtected || targetsProtected) {
        block(`BLOCKED (guard-bash): never push to ${PROTECTED.join("/")}. Push the feature branch (\`git push -u origin <branch>\`) and open a PR (/open-pr).`);
      }
    }

    if (/\bgit\s+add\b/.test(part) && SECRET_FILE.test(part.replace(/^.*?\bgit\s+add\b/, " "))) {
      block(`BLOCKED (guard-bash): \`${part}\` stages a secret file. Never commit .env files or keys.`);
    }
  }
}

const pentestScope = readSessionState(SCOPE_STATE);
for (const part of parts) {
  if (config.blockDangerousCommands) {
    const pentestReason = pentestBlock(part, pentestScope);
    if (pentestReason) block(`BLOCKED (guard-bash): ${pentestReason}`);
    checkRecursiveDelete(part);
    for (const [pattern, why] of RULES) {
      if (pattern.test(part)) block(`BLOCKED (guard-bash): \`${part}\`\nReason: ${why}\n${ASK}`);
    }
  }
  if (config.blockNewDependencies) checkDependencies(part);
}

if (config.enforceGitRules) checkGit();

ok();
