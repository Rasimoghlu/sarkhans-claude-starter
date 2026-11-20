# Changelog

Each section becomes the release notes that people see in the app and on the Releases page. Write them for users.

## 4.6.0
- **Faster everyday work.** Claude now makes small changes itself (up to 3 files per request) instead of starting an agent for every line. Bigger work still goes to the agent team with plans and reviews.
- **Work mode per project:** Lite, Standard or Strict, in the project panel under Claude. Projects that used the old default move to Standard.
- **Much smaller rules.** What Claude reads at the start of every session went from about 10,500 tokens to about 2,800, and each message adds 150 characters instead of 860. More room is left for your code. Detailed rules load only when Claude works on matching files. The project panel shows the number.
- **Agents that learn.** The reviewer, architect, database and security agents keep notes for each project (conventions, decisions, recurring mistakes) and use them next time.
- One `reviewer` agent replaces the separate verifier and code reviewer.
- The final report is required only for changes of 30+ lines (or any database change), not for one-line fixes.
- `/security-audit` runs in its own context, so a long audit no longer fills your conversation.
- **Open in Claude Code** button: opens Terminal in the project folder and starts Claude.
- `CLAUDE.md` is now short (project, stack, commands) and your own `CLAUDE.md` is never touched. Existing projects are converted automatically; the old file is kept in `.claude/CLAUDE.md.before-4.6`.
- Projects with an `AGENTS.md` (Cursor, Codex) keep it: the starter's `CLAUDE.md` imports it.
- Fixed: `/ship` opened pull requests against `main` even when the repository's default branch is different.

## 4.5.5
- Every folder in your projects folder is listed now, not only Node, PHP, Go and Python projects.
- Recognised in addition: Rust, Java/Kotlin (Maven, Gradle), .NET, Ruby, Dart/Flutter, Swift, Docker and static sites. Anything else is shown as "Other" and still gets the full rules.
- `/verify` runs the build and tests of these languages too (cargo, Maven/Gradle, dotnet, rspec, flutter/dart, swift) when the tool is installed.
- The comment rule and the code-quality rules now also cover Rust, Java, Kotlin, C#, Swift, Dart, Ruby, Scala, C/C++ and shell scripts.

## 4.5.4
- The app now checks for new versions every 30 minutes and whenever you switch back to it, not only when it opens. A badge on the Dock icon shows that an update is waiting.
- When an update brings new rules, your set-up projects get them automatically right after the app restarts. There's no second "Update" per project.
- Projects show "Update available" only when the rules really changed, not on every app update.
- You can turn automatic rule updates off in Settings → Projects.

## 4.5.3
- After an update, the app confirms it with "Updated to …" when it opens again.

## 4.5.2
- Fixed: "Update and restart" could stay on "Updating…" forever.
- The update window shows what it's doing: downloading, checking, restarting.
- Tidier built-in skills list.

## 4.5.1
- Updates work when the app is in a folder that needs admin rights: macOS asks for your password once.
- Downloads and updates come from this repository's Releases page.

## 4.5.0
- First release of Sarkhans Claude Starter.
