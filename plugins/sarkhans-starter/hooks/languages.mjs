import { existsSync, statSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, resolve, join, basename } from "node:path";
import { projectDir, readPackageJson, readTsconfigPaths, readText, findTool, pythonInterpreter, run, runStack, containerFor, tail } from "./lib.mjs";

export function languageOf(filePath) {
  const name = basename(filePath).toLowerCase();
  if (name.endsWith(".d.ts")) return null;
  if (name.endsWith(".blade.php")) return "blade";
  if (/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(name)) return "ts";
  if (name.endsWith(".go")) return "go";
  if (name.endsWith(".php")) return "php";
  if (name.endsWith(".py")) return "python";
  if (/\.(rs|java|kt|kts|cs|swift|dart|scala|c|h|cc|cpp|cxx|hpp|m|mm)$/.test(name)) return "clike";
  if (/\.(rb|sh|bash|zsh)$/.test(name)) return "hash";
  return null;
}

export function fileContext(rel, lang, fileText) {
  const name = basename(rel);
  const isTest =
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(name) || /_test\.go$/.test(name) || /^test_.*\.py$|_test\.py$|^conftest\.py$/.test(name) ||
    /Test\.php$/.test(name) || /(^|\/)(tests?|e2e|__tests__|spec)\//.test(rel) ||
    /Tests?\.(java|kt|cs|swift)$/.test(name) || /_(spec|test)\.(rb|dart|rs)$/.test(name) || /(^|\/)src\/test\//.test(rel);
  const isScript = /(^|\/)(scripts|bin|tools)\//.test(rel) || /\.config\.[cm]?[jt]s$/.test(name) ||
    /^(manage|setup|__main__|cli|wsgi|asgi)\.py$/.test(name) || /(^|\/)management\/commands\//.test(rel);
  const isGoMain = lang === "go" && /^\s*package\s+main\b/m.test(fileText);
  const isConfigModule =
    /(^|\/)(env|config|settings)(\.[a-z]+)?\.[a-z]+$/.test(rel) || /(^|\/)(config|settings|env)\//.test(rel) ||
    /^(instrumentation|middleware)\.[jt]s$/.test(name) || /\.config\.[cm]?[jt]s$/.test(name) || /^(bootstrap|public)\//.test(rel);
  return { isTest, isScript, isGoMain, isConfigModule };
}

const DIRECTIVES = {
  ts: /^\s*(\/\s*<reference|@ts-expect-error|@ts-check|eslint-(disable|enable)|prettier-ignore|biome-ignore|istanbul ignore|c8 ignore|@vitest-environment|@jest-environment|webpack[A-Z]\w*|[#@]__PURE__|@refresh|global\s|jsx|@jsx)/,
  go: /^\s*(go:|\+build|nolint|export\s|line\s|#cgo|lint:)/,
  php: /^\s*(phpcs:|@phpstan-|@psalm-|@codeCoverageIgnore|@noinspection|@php-cs-fixer)/,
  python: /^\s*(type:\s*ignore|noqa|pragma:|fmt:|isort:|pyright:|mypy:|ruff:|-\*-|!)/,
  clike: /^\s*(swiftlint:|swift-format-ignore|ignore(_for_file)?:|NOLINT|clang-format|#?pragma|#?region|#?endregion|ReSharper|noinspection|@formatter|ktlint-disable|detekt|spotless:|rustfmt::)/,
  hash: /^\s*(!|frozen_string_literal|rubocop:|shellcheck|-\*-|encoding:|typed:|@|noqa)/,
};
const PHP_TYPE_TAGS = /^@(param|return|var|template(-covariant)?|throws|property(-read|-write)?|method|mixin|extends|implements|use|phpstan-[\w-]+|psalm-[\w-]+|codeCoverageIgnore\w*|internal|deprecated|api|readonly|immutable|final)\b/;
const CODE_LIKE = /^(const|let|var|function|func|def|class|return|import|from|export|if|elif|else|for|while|await|async|interface|type|switch|case|throw|raise|try|echo|public|private|protected|namespace|use)\b|^[\w.$>-]+\(.*\)\s*;?$|^\$\w+\s*=|^<\/?[A-Za-z]|^[}{)\]]|;\s*$|=>|^\w+\s*:?=\s*\S/;

export function stripStrings(line) {
  return line.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');
}

function analyzeCStyle(text, lang) {
  const lines = text.split(/\r?\n/);
  const directive = DIRECTIVES[lang] || DIRECTIVES.ts;
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const stripped = stripStrings(raw);
    const trimmed = stripped.trim();

    const blockStart = trimmed.match(/^\{?\/\*(\*?)(.*)$/);
    if (blockStart) {
      let end = i;
      while (end < lines.length && !lines[end].includes("*/")) end += 1;
      const blockLines = lines.slice(i, Math.min(end, lines.length - 1) + 1);
      const bodies = blockLines
        .map((l) => l.trim().replace(/^\{?\/\*\*?/, "").replace(/\*\/\}?\s*$/, "").replace(/^\*\s?/, "").trim())
        .filter(Boolean);
      const isTypeDocblock = lang === "php" && blockStart[1] === "*" && bodies.length > 0 && bodies.every((b) => PHP_TYPE_TAGS.test(b));
      const isDirective = bodies.length > 0 && bodies.every((b) => directive.test(b));
      const kind = isTypeDocblock || isDirective ? "directive" : "block";
      blockLines.forEach((l, k) => out.push({ raw: l, code: "", comment: bodies[k] || "", kind }));
      i = Math.min(end, lines.length - 1);
      continue;
    }

    const lineComment = lang === "php" ? trimmed.match(/^(\/\/+|#(?!\[))(.*)$/) : trimmed.match(/^(\/\/+)(.*)$/);
    if (lineComment) {
      const body = lineComment[2].trim();
      out.push({ raw, code: "", comment: body, kind: directive.test(body) || directive.test("/" + body) ? "directive" : "line" });
      continue;
    }

    const trailingPattern = lang === "php" ? /^(.*?\S.*?)\s(?:\/\/|#(?!\[))\s?(.*)$/ : /^(.*?\S.*?)\s\/\/\s?(.*)$/;
    const trailing = stripped.match(trailingPattern);
    if (trailing && !/https?:$/.test(trailing[1])) {
      const body = trailing[2].trim();
      out.push({ raw, code: trailing[1], comment: body, kind: directive.test(body) ? "directive" : "trailing" });
      continue;
    }

    const inlineBlock = stripped.match(/\/\*(.*?)(\*\/|$)/);
    if (inlineBlock && !directive.test(inlineBlock[1].trim()) && !/^\s*\*?\s*@/.test(inlineBlock[1])) {
      out.push({ raw, code: stripped.replace(/\{?\/\*.*?\*\/\}?/g, ""), comment: inlineBlock[1].trim(), kind: "block" });
      continue;
    }
    out.push({ raw, code: stripped, comment: null, kind: trimmed ? "code" : "blank" });
  }
  return out;
}

function analyzePython(text, lang = "python") {
  const directive = DIRECTIVES[lang] || DIRECTIVES.python;
  const lines = text.split(/\r?\n/);
  const out = [];
  let triple = null;
  let tripleIsDoc = false;
  lines.forEach((raw, index) => {
    if (triple) {
      out.push({ raw, code: tripleIsDoc ? "" : '""', comment: tripleIsDoc ? raw.trim() : null, kind: tripleIsDoc ? "docstring" : "code" });
      if (raw.includes(triple)) triple = null;
      return;
    }
    const trimmed = raw.trim();
    const docStart = trimmed.match(/^[rRuUbB]?("""|''')/);
    if (docStart) {
      const quote = docStart[1];
      const rest = trimmed.slice(trimmed.indexOf(quote) + 3);
      out.push({ raw, code: "", comment: trimmed, kind: "docstring" });
      if (!rest.includes(quote)) {
        triple = quote;
        tripleIsDoc = true;
      }
      return;
    }
    const tripleCount = (raw.match(/"""|'''/g) || []).length;
    if (tripleCount % 2 === 1) {
      triple = raw.includes('"""') ? '"""' : "'''";
      tripleIsDoc = false;
      out.push({ raw, code: stripStrings(raw.slice(0, raw.search(/"""|'''/))), comment: null, kind: "code" });
      return;
    }
    const stripped = stripStrings(raw);
    if (stripped.trim().startsWith("#")) {
      const body = stripped.trim().replace(/^#+/, "").trim();
      const isHeader = index < 2 && /^(!|.*coding[:=])/.test(body);
      out.push({ raw, code: "", comment: body, kind: isHeader || directive.test(body) ? "directive" : "line" });
      return;
    }
    const trailing = stripped.match(/^(.*?\S.*?)\s#\s?(.*)$/);
    if (trailing) {
      const body = trailing[2].trim();
      out.push({ raw, code: trailing[1], comment: body, kind: directive.test(body) ? "directive" : "trailing" });
      return;
    }
    out.push({ raw, code: stripped, comment: null, kind: trimmed ? "code" : "blank" });
  });
  return out;
}

export function analyze(text, lang) {
  return lang === "python" || lang === "hash" ? analyzePython(text, lang) : analyzeCStyle(text, lang);
}

export function commentProblems(writtenLines, fileLines) {
  const problems = [];
  let consecutive = 0;
  let newComments = 0;
  for (const line of writtenLines) {
    const isComment = ["line", "trailing", "block", "docstring"].includes(line.kind);
    consecutive = line.kind === "line" ? consecutive + 1 : 0;
    if (!isComment) continue;
    newComments += 1;
    if (line.kind === "docstring") problems.push(["Docstring — not allowed. Names and type hints document the code.", line.raw]);
    else if (line.kind === "block") problems.push(["Block/doc comment — not allowed. Make the code self-explanatory (naming, small functions).", line.raw]);
    else if (/\b(TODO|FIXME|HACK|XXX)\b/.test(line.comment)) problems.push(["TODO/FIXME/HACK comment — finish the work or report it to the user instead.", line.raw]);
    else if (CODE_LIKE.test(line.comment)) problems.push(["Commented-out code — delete it (git keeps history).", line.raw]);
    else if (line.comment.length > 100) problems.push(["Comment longer than 100 chars — only one short 'why' line is allowed in complex code.", line.raw]);
    else if (consecutive === 2) problems.push(["Multi-line comment — at most one short line, only in genuinely complex code.", line.raw]);
  }
  if (newComments > 0) {
    const commentCount = fileLines.filter((l) => ["line", "trailing", "block", "docstring"].includes(l.kind)).length;
    const codeCount = fileLines.filter((l) => l.code && l.code.trim() && l.code !== '""').length;
    const allowed = Math.floor(codeCount / 25);
    if (commentCount > allowed) {
      problems.push([`Too many comments: ${commentCount} comment line(s) for ${codeCount} code lines (max 1 per 25 lines of genuinely complex code). Remove comments that restate the code.`]);
    }
  }
  return problems;
}

const DIRECTIVE_REASON_CHECKS = {
  ts: [
    [/@ts-ignore|@ts-nocheck/, "`@ts-ignore`/`@ts-nocheck` — fix the type error instead"],
    [/@ts-expect-error(?!\s*(?:--?|:)?\s*\S.{5,})/, "`@ts-expect-error` without a reason — add `-- <reason>`"],
    [/eslint-disable(?!.*--\s*\S.{5,})/, "`eslint-disable` without a reason — fix the issue, or add `-- <reason>`"],
  ],
  python: [
    [/#\s*type:\s*ignore(?!\[)/, "bare `# type: ignore` — fix the type error, or use `# type: ignore[code]`"],
    [/#\s*noqa(?!\s*:\s*[A-Z]+\d)/, "bare `# noqa` — fix the issue, or name the rule: `# noqa: E501`"],
    [/#\s*pyright:\s*ignore(?!\[)/, "bare `# pyright: ignore` — name the rule"],
  ],
  go: [[/\/\/\s*nolint(?!:)/, "bare `//nolint` — fix the issue, or name the linter: `//nolint:errcheck // reason`"]],
  php: [[/@phpstan-ignore(-next-line|-line)?\s*(\*\/)?\s*$/, "`@phpstan-ignore` without an identifier — fix the issue, or add the error identifier"]],
};

export function codeProblems({ lang, rel, written, writtenLines, fileText, tool, ctx, config }) {
  const problems = [];
  const add = (label, line) => problems.push([label, line]);
  const notTest = !ctx.isTest;
  const appCode = !ctx.isTest && !ctx.isScript;

  const lineChecks = {
    ts: [
      [/(:\s*any\b(?!\s*[\w$])|\bas\s+any\b|<any\s*>|\bany\[\]|Array<any>|,\s*any\s*>)/, "`any` type — use `unknown` + narrowing/validation, a generic, or a real type", /\.(ts|tsx|mts|cts)$/.test(rel)],
      [/\bas\s+unknown\s+as\b/, "`as unknown as X` double cast — fix the types instead of silencing them", true],
      [/(^|[^=!<>])==(?!=)|!=(?!=)/, "`==`/`!=` — use `===`/`!==`", true],
      [/\beval\s*\(|\bnew\s+Function\s*\(/, "`eval`/`new Function` — forbidden (code injection risk)", true],
      [/\bdebugger\b/, "`debugger` statement", true],
      [/\bconsole\.(log|debug|trace)\s*\(/, "`console.log` in app code — remove it or use the project logger", appCode],
      [/\b(it|test|describe)\.(only|skip)\s*\(/, "`.only`/`.skip` in tests — never commit focused or skipped tests", ctx.isTest],
    ],
    go: [
      [/\bpanic\s*\(/, "`panic` outside main/tests — return an error instead", notTest && !ctx.isGoMain],
      [/\bfmt\.Print(ln|f)?\s*\(/, "`fmt.Print*` debugging — use the structured logger (log/slog or the project's)", appCode && !ctx.isGoMain],
      [/\bcontext\.TODO\(\)/, "`context.TODO()` — pass the caller's context", notTest],
      [/\b(os\.Exit|log\.Fatal\w*)\s*\(/, "`os.Exit`/`log.Fatal` outside main — return an error to the caller", notTest && !ctx.isGoMain],
      [/^\s*_\s*=\s*err\b/, "`_ = err` — never ignore errors", true],
      [/\bInsecureSkipVerify\s*:\s*true/, "TLS verification disabled (InsecureSkipVerify)", true],
      [/\bt\.Skip(Now|f)?\s*\(/, "`t.Skip` — never skip tests to make the suite pass", ctx.isTest],
    ],
    php: [
      [/(^|[^=!<>])==(?!=)|!=(?!=)|<>/, "loose comparison `==`/`!=`/`<>` — use `===`/`!==`", true],
      [/\b(var_dump|print_r|var_export|dd|dump|ray)\s*\(/, "debug output (`var_dump`/`dd`/`dump`/`print_r`) — remove it", true],
      [/\b(die|exit)\s*(\(|;)/, "`die`/`exit` in app code — throw or return a response", appCode],
      [/\b(eval|extract|create_function)\s*\(/, "`eval`/`extract` — forbidden", true],
      [/(^|[\s(=,!.])@\$?[a-zA-Z_]\w*\s*\(/, "`@` error suppression — handle the error explicitly", true],
      [/\bglobal\s+\$/, "`global` variables — inject dependencies instead", true],
      [/CURLOPT_SSL_VERIFY(PEER|HOST)\s*=>\s*(false|0)/, "TLS verification disabled (CURLOPT_SSL_VERIFYPEER)", true],
      [/\$guarded\s*=\s*\[\s*\]/, "`$guarded = []` — use explicit `$fillable` (mass assignment)", true],
      [/->(markTestSkipped|markTestIncomplete)\s*\(|->skip\s*\(/, "skipped test — never skip tests to make the suite pass", ctx.isTest],
    ],
    python: [
      [/^\s*except\s*:/, "bare `except:` — catch a specific exception", true],
      [/(==|!=)\s*None\b/, "`== None` — use `is None` / `is not None`", true],
      [/^\s*from\s+\S+\s+import\s+\*/, "`import *` — import names explicitly", true],
      [/(:\s*|->\s*|\[\s*|,\s*)Any\b/, "`Any` type — use a precise type, Protocol, TypedDict or generic", true],
      [/^\s*(async\s+)?def\s+\w+\([^)]*=\s*(\[\]|\{\}|set\(\)|dict\(\)|list\(\))/, "mutable default argument — use `None` and create inside", true],
      [/\b(eval|exec)\s*\(/, "`eval`/`exec` — forbidden (code injection risk)", true],
      [/\bshell\s*=\s*True\b/, "`shell=True` — pass an argument list instead (command injection risk)", true],
      [/\bverify\s*=\s*False\b/, "TLS verification disabled (`verify=False`)", true],
      [/\bpickle\.loads?\s*\(|\byaml\.load\s*\((?![^)]*Loader)/, "unsafe deserialization (`pickle`/`yaml.load`) — use safe formats/`yaml.safe_load`", true],
      [/\bprint\s*\(/, "`print()` in app code — use `logging`", appCode],
      [/@pytest\.mark\.skip\b|\bpytest\.skip\s*\(|@unittest\.skip\b/, "skipped test — never skip tests to make the suite pass", ctx.isTest],
    ],
  };

  for (const line of writtenLines) {
    if (!line.code) continue;
    for (const [pattern, label, enabled] of lineChecks[lang] || []) if (enabled && pattern.test(line.code)) add(label, line.raw);
  }
  for (const line of written.split(/\r?\n/)) {
    for (const [pattern, label] of DIRECTIVE_REASON_CHECKS[lang] || []) if (pattern.test(line)) add(label, line);
  }

  const code = writtenLines.map((l) => l.code).join("\n");
  if ((lang === "ts" || lang === "php") && /catch\s*(\([^)]*\))?\s*\{\s*\}/.test(code)) add("Empty `catch {}` — never swallow errors. Handle, rethrow with context, or return a typed error.");
  if (lang === "ts" && /\.catch\(\s*(\(\s*\w*\s*\)|\w+)\s*=>\s*(\{\s*\}|null|undefined|void 0)\s*\)/.test(code)) add("`.catch(() => {})` swallows errors — handle or propagate them.");
  if (lang === "go" && /if\s+err\s*!=\s*nil\s*\{\s*\}/.test(code)) add("Empty `if err != nil {}` — handle or return the error with context.");
  if (lang === "python" && /except[^\n:]*:\s*(\n\s*)?(pass|\.\.\.)\s*(\n|$)/.test(code)) add("`except ...: pass` swallows errors — handle, log with context, or re-raise.");
  if (lang === "ts" && /dangerouslySetInnerHTML/.test(code) && !/sanitize|DOMPurify/i.test(fileText)) add("`dangerouslySetInnerHTML` without sanitization (DOMPurify) in this file — XSS risk.");
  if (lang === "php" && tool === "Write" && !/declare\s*\(\s*strict_types\s*=\s*1\s*\)/.test(fileText) && !/(^|\/)(config|resources|lang|routes|database\/migrations)\//.test(rel)) {
    add("New PHP file without `declare(strict_types=1);` at the top.");
  }

  const rawSql = {
    ts: /\b(query|execute|raw|\$queryRawUnsafe|\$executeRawUnsafe)\s*\(\s*`[^`]*\$\{/,
    go: /\b(Query|QueryRow|Exec|QueryContext|ExecContext|QueryRowContext)\s*\(\s*(ctx\s*,\s*)?fmt\.Sprintf/,
    php: /(Raw|query|exec|prepare|mysqli_query|DB::(select|insert|update|delete|statement|unprepared))\s*\(\s*(["'][^"']*["']\s*\.\s*\$|"[^"]*\$\w)/,
    python: /\b(execute|executemany|raw|text)\s*\(\s*(f["']|["'][^"']*["']\s*(%|\.format\())/,
  }[lang];
  const sqlLine = rawSql && written.split(/\r?\n/).find((l) => rawSql.test(l));
  if (sqlLine) add("SQL built from interpolated values — use bindings/placeholders (SQL injection risk).", sqlLine);

  if (config.enforceEnvModule && !ctx.isConfigModule && !ctx.isTest && !ctx.isScript) {
    const envPattern = {
      ts: /process\.env\.(?!NODE_ENV\b|NEXT_RUNTIME\b)\w+|process\.env\[/,
      go: /\bos\.(Getenv|LookupEnv)\s*\(/,
      php: existsSync(join(projectDir, "artisan")) ? /\benv\s*\(|\bgetenv\s*\(|\$_ENV\[/ : null,
      python: /\bos\.(environ|getenv)\b/,
    }[lang];
    const envLine = envPattern && writtenLines.find((l) => envPattern.test(l.code));
    if (envLine) add("Env read outside the config module — read it once in the validated config module (src/env.ts / internal/config / config/*.php / settings.py) and import the value.", envLine.raw);
  }

  if (tool === "Write" && config.maxNewFileLines) {
    const lineCount = fileText.split(/\r?\n/).length;
    if (lineCount > config.maxNewFileLines) add(`File has ${lineCount} lines (max ${config.maxNewFileLines}). Split it by responsibility into smaller modules.`);
  }
  return problems;
}

function tsImportProblems(written, filePath) {
  const problems = [];
  const pkg = readPackageJson() || {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies, ...pkg.optionalDependencies };
  const aliases = readTsconfigPaths();
  const builtins = new Set(builtinModules);
  const EXT = ["", ".ts", ".tsx", ".d.ts", ".js", ".jsx", ".mjs", ".cjs", ".json"];
  const exists = (base) =>
    [base, base.replace(/\.(m|c)?js$/, ".$1ts"), base.replace(/\.jsx?$/, ".tsx")].some(
      (c) => EXT.some((e) => existsSync(c + e) && statSync(c + e).isFile()) || EXT.slice(1).some((e) => existsSync(resolve(c, "index" + e))),
    );
  const pattern = /(?:import|export)\s[^'"`;]*?\sfrom\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const specs = new Set([...written.matchAll(pattern)].map((m) => m[1] || m[2] || m[3] || m[4]));
  for (const spec of specs) {
    if (!spec || spec.includes(":") || builtins.has(spec) || builtins.has(spec.split("/")[0])) continue;
    if (spec.startsWith(".")) {
      if (!exists(resolve(dirname(filePath), spec))) problems.push(`Import "${spec}" points to a file that does not exist.`);
      continue;
    }
    const alias = aliases.find((a) => a.prefix && spec.startsWith(a.prefix));
    if (alias) {
      if (!alias.targets.some((t) => exists(resolve(t, spec.slice(alias.prefix.length))))) problems.push(`Import "${spec}" points to a file that does not exist.`);
      continue;
    }
    const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
    if (!deps[name] && !deps["@types/" + name.replace(/^@/, "").replace("/", "__")]) problems.push(`Package "${name}" is not in package.json.`);
  }
  return problems;
}

function goImportProblems(written) {
  const goMod = readText("go.mod");
  if (!goMod) return [];
  const moduleName = goMod.match(/^module\s+(\S+)/m)?.[1] || "";
  const required = [...goMod.matchAll(/^\s*(?:require\s+)?([a-z0-9.-]+\.[a-z]{2,}\/\S+)\s+v\S+/gm)].map((m) => m[1]);
  const blocks = [...written.matchAll(/import\s*\(([\s\S]*?)\)/g)].map((m) => m[1]).join("\n");
  const singles = [...written.matchAll(/import\s+(?:\w+\s+)?"([^"]+)"/g)].map((m) => m[1]);
  const specs = new Set([...singles, ...[...blocks.matchAll(/"([^"]+)"/g)].map((m) => m[1])]);
  const problems = [];
  for (const spec of specs) {
    const first = spec.split("/")[0];
    if (spec === "C" || !first.includes(".")) continue;
    if (moduleName && (spec === moduleName || spec.startsWith(moduleName + "/"))) {
      if (!existsSync(join(projectDir, spec.slice(moduleName.length)))) problems.push(`Import "${spec}" points to a package directory that does not exist.`);
      continue;
    }
    if (!required.some((r) => spec === r || spec.startsWith(r + "/"))) problems.push(`Module for "${spec}" is not in go.mod.`);
  }
  return problems;
}

function phpImportProblems(written) {
  const php = findTool("php");
  if ((!php && !containerFor("php")) || !existsSync(join(projectDir, "vendor", "autoload.php"))) return [];
  const names = [...written.matchAll(/^\s*use\s+(?!function\s|const\s)\\?([A-Za-z_][\w]*\\[\w\\]+)(\s+as\s+\w+)?\s*;/gm)].map((m) => m[1]);
  if (!names.length) return [];
  const script = 'require "vendor/autoload.php"; foreach (array_slice($argv, 1) as $c) { if (!class_exists($c) && !interface_exists($c) && !trait_exists($c) && !(function_exists("enum_exists") && enum_exists($c))) { echo $c, PHP_EOL; } }';
  const result = runStack("php", { host: php, container: "php" }, ["-r", script, "--", ...new Set(names)], { timeoutMs: 30_000 });
  if (result.code !== 0 || result.skipped) return [];
  return result.out.split(/\r?\n/).filter(Boolean).map((c) => `Class "${c}" does not exist (not in the project or vendor/).`);
}

function pythonImportProblems(written) {
  const python = pythonInterpreter();
  if (!python && !containerFor("python")) return [];
  const names = new Set();
  const localProblems = [];
  const roots = [projectDir, join(projectDir, "src")];
  for (const m of written.matchAll(/^\s*(?:from\s+([A-Za-z_][\w.]*)\s+import|import\s+([A-Za-z_][\w.]*(?:\s*,\s*[A-Za-z_][\w.]*)*))/gm)) {
    const list = m[1] ? [m[1]] : m[2].split(",").map((s) => s.trim().split(/\s+/)[0]);
    for (const full of list) {
      const parts = full.split(".");
      const localRoot = roots.find((r) => existsSync(join(r, parts[0])) || existsSync(join(r, parts[0] + ".py")));
      if (localRoot && parts.length > 1) {
        const base = join(localRoot, ...parts);
        if (![base + ".py", join(base, "__init__.py"), base].some((c) => existsSync(c))) localProblems.push(`Module "${full}" does not exist in the project.`);
        continue;
      }
      names.add(parts[0]);
    }
  }
  if (!names.size) return localProblems;
  const script = "import importlib.util,sys,os\nsys.path[:0]=[os.getcwd(),os.path.join(os.getcwd(),'src')]\nfor n in sys.argv[1:]:\n    if importlib.util.find_spec(n) is None: print(n)";
  const result = runStack("python", { host: python, container: "python" }, ["-c", script, ...names], { timeoutMs: 30_000 });
  if (result.code !== 0 || result.skipped) return localProblems;
  return [...localProblems, ...result.out.split(/\r?\n/).filter(Boolean).map((n) => `Module "${n}" cannot be imported in this project's environment (not installed, not declared, or a wrong name).`)];
}

export function importProblems(lang, written, filePath) {
  const list = { ts: tsImportProblems, go: goImportProblems, php: phpImportProblems, python: pythonImportProblems }[lang];
  const found = list ? list(written, filePath) : [];
  return found.map((p) => `${p} Either it is hallucinated (check the real name/API) or it must be created/approved first — never guess.`);
}

export function formatAndLint(lang, filePath, config) {
  const problems = [];
  const report = (label, out) => problems.push(`${label}:\n${tail(out, 25).replace(/^/gm, "      ")}`);

  if (lang === "ts") {
    const prettier = config.formatOnEdit && findTool("prettier", { localOnly: true });
    if (prettier) {
      const r = run(prettier, ["--write", "--ignore-unknown", filePath], { timeoutMs: 30_000 });
      if (r.code !== 0 && !r.timedOut) report("Prettier could not format the file (usually a syntax error)", r.out);
    }
    const eslint = config.lintOnEdit && findTool("eslint", { localOnly: true });
    if (eslint) {
      const r = run(eslint, ["--fix", filePath], { timeoutMs: 60_000 });
      const ignoredOnly = /File ignored/i.test(r.out) && !/\d+:\d+\s+(error|warning)/.test(r.out);
      if (r.code === 1 && !ignoredOnly) report("ESLint errors remain after --fix", r.out);
    }
  }

  if (lang === "go") {
    if (config.formatOnEdit) {
      const r = runStack("go", { host: findTool("goimports") || findTool("gofmt"), container: "gofmt", preferHost: true }, ["-w", filePath], { timeoutMs: 30_000 });
      if (r.code !== 0 && !r.timedOut) report("gofmt failed (syntax error)", r.out);
    }
  }

  if (lang === "php" || lang === "blade") {
    if (lang === "php") {
      const r = runStack("php", { host: findTool("php"), container: "php" }, ["-l", filePath], { timeoutMs: 30_000 });
      if (r.code !== 0 && !r.timedOut) report("PHP syntax error", r.out);
    }
    const pint = config.formatOnEdit && lang === "php" && findTool("pint", { localOnly: true });
    const fixer = config.formatOnEdit && lang === "php" && !pint && findTool("php-cs-fixer", { localOnly: true });
    if (pint) runStack("php", { host: findTool("php") ? pint : null, container: "vendor/bin/pint" }, [filePath], { timeoutMs: 60_000 });
    else if (fixer) runStack("php", { host: findTool("php") ? fixer : null, container: "vendor/bin/php-cs-fixer" }, ["fix", filePath, "--quiet"], { timeoutMs: 60_000 });
  }

  if (lang === "python") {
    const r = runStack("python", { host: pythonInterpreter(), container: "python" }, ["-m", "py_compile", filePath], { timeoutMs: 30_000 });
    if (r.code !== 0 && !r.timedOut) report("Python syntax error", r.out);
    const ruff = findTool("ruff");
    if (ruff) {
      if (config.formatOnEdit) run(ruff, ["format", "--quiet", filePath], { timeoutMs: 30_000 });
      if (config.lintOnEdit) {
        const r = run(ruff, ["check", "--fix", "--quiet", filePath], { timeoutMs: 30_000 });
        if (r.code === 1) report("Ruff errors remain after --fix", r.out);
      }
    } else {
      const black = config.formatOnEdit && findTool("black");
      if (black) run(black, ["--quiet", filePath], { timeoutMs: 30_000 });
    }
  }
  return problems;
}

export function readFileSafe(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}
