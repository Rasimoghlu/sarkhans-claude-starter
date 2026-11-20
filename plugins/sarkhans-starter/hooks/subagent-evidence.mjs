import { readInput, loadConfig, block, ok, lastAssistantText } from "./lib.mjs";

const EVIDENCE_HEADING = /#{2,4}\s*(Evidence|Sübut|Subut)\b/i;

const input = await readInput();
const config = loadConfig();
if (!config.requireSubagentEvidence || input.stop_hook_active) ok();

const text = lastAssistantText(input, "agent_transcript_path");
if (text === null || EVIDENCE_HEADING.test(text)) ok();

block(
  "subagent-evidence: your report has no evidence section. The main agent will verify every claim, so end your final message with:\n\n" +
    "### Evidence\n" +
    "- Files changed: <path — what changed> (or `none`)\n" +
    "- Files/lines relied on: <path:line — what it shows>\n" +
    "- Commands run: <command — exit code — key output line>\n" +
    "- Not verified / assumptions: <anything you could not confirm>\n\n" +
    "Only list what you actually did and saw. Never invent results.",
);
