# Sarkhans Claude Starter

An Agentic Development Environment for Claude Code: one install adds an orchestrator with specialist agents, strict quality/security/design/database rules enforced by hooks, and a catalog of design skills — for projects in any language, with extra support for TypeScript/Next.js, Go, PHP (Laravel/Symfony), Python (Django/FastAPI), Rust, Java/Kotlin, .NET, Ruby, Dart/Flutter, Swift and Docker.

## ⬇️ Install
**Easiest:** open **Terminal** (⌘ Space → type "Terminal" → Enter), paste this line and press Enter:

```bash
curl -fsSL https://raw.githubusercontent.com/sarkhandigitech/sarkhans-claude-starter/main/install.sh | bash
```

It downloads the latest version, puts it in Applications and opens it. You don't need to allow anything in System Settings. Running the same line again reinstalls the latest version.

**Or download the installer:** [Sarkhans Claude Starter for Mac (.dmg)](https://github.com/sarkhandigitech/sarkhans-claude-starter/releases/latest/download/Sarkhans-Claude-Starter.dmg). macOS asks you to approve it once, see below.

macOS 13 or newer · Apple Silicon and Intel · always the latest version

- What it does and how it works: [`claude-web-starter/README.md`](claude-web-starter/README.md)
- Internals, CLI contract, Windows porting notes: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## Requirements
- To use: macOS 13+, Claude Code. Node.js and Git can be installed from inside the app.
- To build the app: Xcode Command Line Tools (`xcode-select --install`).

## For colleagues: install the app
**With one line (recommended).** Paste this into Terminal:
```bash
curl -fsSL https://raw.githubusercontent.com/sarkhandigitech/sarkhans-claude-starter/main/install.sh | bash
```
The app is installed and opens. Skip to step 4 below.

**With the DMG installer:**
1. Download [Sarkhans-Claude-Starter.dmg](https://github.com/sarkhandigitech/sarkhans-claude-starter/releases/latest/download/Sarkhans-Claude-Starter.dmg), open it and drag the app to **Applications**. Without admin rights, use `~/Applications`, the Applications folder in your home folder (create it if it's missing).
2. Double-click the app. macOS says it can't verify the app: click **Done**. The app isn't notarized by Apple, so this happens once.
3. Approve it:
   - **macOS 15 Sequoia and macOS 26 Tahoe:** Apple menu → **System Settings** → **Privacy & Security**. Scroll down to **Security**; next to "Sarkhans Claude Starter was blocked…" click **Open Anyway**, then **Open Anyway** again, and enter your Mac password. The button is shown for about an hour after you tried to open the app; if it's gone, double-click the app again.
   - **macOS 13–14:** right-click the app → **Open** → **Open**.
4. Follow the setup screen (Node.js, Git, projects folder), select projects and press **Set up**.

No GitHub account is needed. The app checks for new versions when it opens. When there's one, an **Update to x.y.z** button appears: it downloads the new version, replaces the app and restarts. If the app's folder needs admin rights, macOS asks for the password.

## Publishing an update
Releases are automatic. Every merge to `main` that changes `claude-web-starter/VERSION` builds the app on GitHub (Actions → **Release**) and publishes it on this repository's Releases page. The download link and everyone's **Update** button then point to it. The app checks for new versions when it opens, every 30 minutes, and when you switch back to it. After an update, set-up projects get the new rules automatically, but only when the rules actually changed. Merges that don't change the version publish nothing.

1. Make the change on a branch, bump `claude-web-starter/VERSION` (e.g. `4.5.4` → `4.5.5`) and add a `## 4.5.5` section to `CHANGELOG.md`. That section becomes the release notes people see in the app, so write it for users.
2. Open a pull request and **Merge** it on GitHub.
3. Wait about 5 minutes. The new version is behind the download link and in everyone's app.

Only the owner and invited collaborators can push. Visitors can read and download, nothing else. Never commit secrets.

To retry a release by hand: Actions → Release → **Run workflow** (it publishes only if that version doesn't exist yet).

## Building locally (optional)
Needs Xcode Command Line Tools (`xcode-select --install`):
```bash
UPDATE_REPO=owner/repo ./macos-app/build-app.sh   # → dist/Sarkhans-Claude-Starter.dmg + .zip
./macos-app/build-app.sh --dev                    # development app that recompiles the Swift source on launch
```
To skip the "Open Anyway" step for everyone, sign and notarize with an Apple Developer ID (paid Apple Developer account):
```bash
xcrun notarytool store-credentials claude-starter --apple-id you@company.com --team-id TEAMID
NOTARY_PROFILE=claude-starter ./macos-app/build-app.sh
```

Without the app:
```bash
node claude-web-starter/install.mjs ~/path/to/project
node claude-web-starter/install.mjs --help
```

## Repository layout
| Folder | Content |
|---|---|
| `claude-web-starter/` | installer (Node), project template, rules, skills, agents, hooks, stack packs, skill catalog |
| `macos-app/` | SwiftUI app source, launcher, Info.plist, icon, `build-app.sh`, `make-shareable.sh`, `update-repo.txt` |
| `.github/workflows/` | automatic release when `VERSION` changes on `main` |
| `docs/` | architecture and porting guide |

## Contributing
- Every release bumps `claude-web-starter/VERSION` (app and rules share one version number).
- Test hooks with the stdin examples in `docs/ARCHITECTURE.md`.
- Third-party skills from the catalog are downloaded from their own repositories at install time and keep their own licenses; they are not part of this repository.
