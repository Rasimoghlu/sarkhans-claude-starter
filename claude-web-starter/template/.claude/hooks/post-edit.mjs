import { existsSync } from "node:fs";
import { readInput, loadConfig, block, ok, relPath, SECRET_PATTERNS } from "./lib.mjs";
import { languageOf, fileContext, analyze, commentProblems, codeProblems, importProblems, formatAndLint, readFileSafe } from "./languages.mjs";
import { schemaProblems } from "./db-lint.mjs";

const input = await readInput();
const config = loadConfig();
const tool = input.tool_name || "";
const toolInput = input.tool_input || {};
const filePath = toolInput.file_path || "";
if (!filePath || !existsSync(filePath)) ok();

const rel = relPath(filePath);
if (!rel || /^(node_modules|vendor|\.venv|venv|\.next|\.git|dist|build)\//.test(rel)) ok();

const written = [toolInput.content, toolInput.new_string, ...(Array.isArray(toolInput.edits) ? toolInput.edits.map((e) => e?.new_string) : [])]
  .filter((s) => typeof s === "string")
  .join("\n");
const fileText = readFileSafe(filePath);
const lang = languageOf(filePath);
const isTooling = rel.startsWith(".claude/");

const problems = [];
const seen = new Set();
const report = (label, line) => {
  if (seen.has(label)) return;
  seen.add(label);
  problems.push(`  • ${label}${line ? `\n      > ${String(line).trim().slice(0, 140)}` : ""}`);
};

if (config.checkForbiddenPatterns) {
  for (const [pattern, label] of SECRET_PATTERNS) {
    const hit = written.split(/\r?\n/).find((l) => pattern.test(l));
    if (hit) report(`Hardcoded secret (${label}). Remove it, rotate it if it was real, and read it from the config module.`, hit.replace(pattern, "<redacted>"));
  }
  if (lang === "blade") {
    const raw = written.split(/\r?\n/).find((l) => /\{!!/.test(l));
    if (raw) report("Unescaped Blade output `{!! !!}` — use `{{ }}` unless the content is sanitized.", raw);
  }
}

if (lang && lang !== "blade" && !isTooling) {
  const ctx = fileContext(rel, lang, fileText);
  const writtenLines = analyze(written, lang);

  if (config.enforceCommentPolicy) {
    for (const [label, line] of commentProblems(writtenLines, analyze(fileText, lang))) report(label, line);
  }
  if (config.checkForbiddenPatterns) {
    for (const [label, line] of codeProblems({ lang, rel, written, writtenLines, fileText, tool, ctx, config })) report(label, line);
  }
  if (config.checkImports) {
    for (const label of importProblems(lang, written, filePath)) report(label);
  }
}

if (config.checkDbDesign !== false && !isTooling) {
  for (const [label, line] of schemaProblems(rel, written, fileText)) report(label, line);
}

if (lang && !isTooling) {
  for (const label of formatAndLint(lang, filePath, config)) report(label);
}

if (problems.length) {
  block(`post-edit hook found problems in ${rel}. Fix them now — do not suppress, bypass, or move them elsewhere:\n${problems.join("\n")}`);
}
ok();
