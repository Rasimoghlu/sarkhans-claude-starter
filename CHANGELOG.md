# Changelog

Each section becomes the release notes that people see in the app and on the Releases page. Write them for users.

## 4.12.0
- **New `/fix-bug` skill.** Tell Claude what's broken and it works through it step by step: reproduce the bug, write a test that fails because of it, find the real cause, make the smallest fix, then run the test and the full checks again. No more "fixed" without proof, and no fixes that only hide the error. The report names the cause, the fix and any other places with the same mistake.
- **Rules for Rust, Java/Kotlin, .NET, Ruby, Dart/Flutter and Swift.** Projects in these languages now get their own rules file, set up automatically: error handling, async and concurrency, the main frameworks (Spring, ASP.NET Core and EF Core, Rails, Flutter, SwiftUI, Axum, Vapor), safe SQL and tests. Claude writes code the way experienced developers in that language expect.
- **Guardrails for these languages.** Hooks now stop swallowed errors (empty `catch`, `rescue nil`), debug output and leftover stubs (`dbg!`, `todo!`, `binding.pry`, `printStackTrace`, `print`), skipped tests and disabled TLS checks. Edited Rust, Kotlin, Dart and Swift files are formatted automatically when the formatter is installed.
- **Xcode projects are recognized.** iOS and macOS apps without a `Package.swift` now get the Swift rules, and `/verify` explains how to build them with `xcodebuild`.
- Existing projects without git history in these languages are no longer mistaken for new projects.

## 4.11.1
- Projects set up with an early version of the starter now get the slim `CLAUDE.md` too. Before, their old copy of the rules stayed in place, including the old "report every problem" third-eye rule. Your project description, stack and commands are kept, and the old file is saved in `.claude/CLAUDE.md.before-4.6`.

## 4.11.0
- **A quieter third eye.** Claude now reports only problems that matter: security holes, data loss, bugs that crash or give wrong results, a broken build, serious performance problems and vulnerable dependencies. No more style notes, naming tips or "might be a problem" guesses. Each finding names the file and line and what would go wrong. When nothing serious turns up, the section is one line: `No critical issues.`
- **Rules stay in their projects.** The starter no longer writes rules into `~/.claude/CLAUDE.md`, so projects without the starter work like plain Claude Code again. Rules that earlier versions put there are removed on the next update, and your own text in that file is kept (backup: `~/.claude/CLAUDE.md.starter-backup`).

## 4.10.0
- **Modern Web Guidance by Google Chrome, on by default.** Every newly set-up web project (with a `package.json`, an `index.html` or a `composer.json`) gets Chrome's Modern Web Guidance skill: before writing UI code, Claude looks up current practice for accessibility, performance, security (CSP, sanitization, passkeys), forms, dialogs and layout, built with Firefox and Edge. In existing projects, turn it on under the project's skills.
- The plugin now installs Modern Web Guidance together with itself.
- `/ui-review` checks the code against these guides when they're installed.

## 4.9.0
- **Pentest.** New `/pentest` skill: Claude tests your running app the way an attacker would (login, other users' data, admin rights, injection, XSS, SSRF, redirects, CSRF, rate limits, uploads, error pages, headers). A hole counts only with the real request and response that prove it, and each one becomes a failing test before it's fixed, after you agree. Findings go to `reports/pentest-<date>.md`.
- **Safe by design.** A pentest reaches only your computer or a staging server you name. Security tools such as nmap, sqlmap, nuclei or ZAP are blocked against every other host, and the scope ends by itself after 2 hours.
- `/security-audit` (reads the code) and `/pentest` (tests the running app) now appear side by side in the app and in the docs.
- A ready GitHub workflow in `examples/github` runs Anthropic's security review on every pull request.

## 4.8.0
- **A team per project.** Settings → Team rules can now hold several teams. Pick a default team for all your projects, and on any project's page choose another team or No team. Each team shows how many projects use it.
- **Team rules in the plugin.** Plugin users on Windows, Linux and macOS can use team rules too: `/sarkhans-starter:team use <folder>` for the current project, `/sarkhans-starter:team set-default <folder>` for every project. You can also describe what you want in your own words. The team's work mode and language apply as well.
- Installer in a terminal: new `--teams`, `--add-team`, `--remove-team`, and per project `--team <folder>`, `--no-team`, `--default-team`.
- Projects update only when their own team's rules change, not when another team changes.

## 4.7.1
- New app icon: the Night Owl, a reviewer that never sleeps.
- The app is now called Sarkhan’s Claude Starter in Finder, the Dock and its windows. Downloads and updates keep working as before.

## 4.7.0
- **Guardrail report.** Each project panel shows what the rules stopped in the last 7 days: secrets, invented imports, git mistakes, comments, swallowed errors, design changes and more. The overview shows the weekly total. The log stays on your Mac.
- **Team rules.** Settings → Team rules: pick a shared folder (for example a git repository) with your team's rules. Every set-up project gets them, and when the folder changes, projects update by themselves.
- **Claude Code check.** Setup and the overview show whether Claude Code is installed, with an Install button that runs Anthropic's official installer.
- **Claude Code plugin.** The rules, agents, skills and guardrails can now be installed as a plugin on Windows, Linux and macOS, without the app.
- Project site with a permanent download link, MIT license, privacy note and issue forms.

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
