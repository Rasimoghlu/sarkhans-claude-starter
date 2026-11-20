# Privacy

Sarkhans Claude Starter doesn't collect, store or send any personal data or usage data.

- **The app** reads the folders you choose on your Mac and writes the starter's files into the projects you set up. It contacts only GitHub (`api.github.com` and the release download) to check for and download updates, and nodejs.org if you press **Install Node.js**. If you press **Install Claude Code**, Terminal runs Anthropic's official installer from claude.ai. Skills you turn on are downloaded from GitHub; MCP servers you turn on are started by Claude Code (usually through npm).
- **The guardrail log** (`.claude/logs/guardrails.jsonl` in each project) stays on your Mac. Nothing is uploaded.
- **Team rules** are read from a folder you pick. The app doesn't upload them anywhere.
- **Claude Code** itself is Anthropic's product and has its own terms and privacy policy. The starter only adds files that Claude Code reads.
