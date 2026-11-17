# Sarkhans Claude Starter

An Agentic Development Environment for Claude Code: one install adds an orchestrator with specialist agents, strict quality/security/design/database rules enforced by hooks, and a catalog of design skills — for TypeScript/Next.js, Go, PHP (Laravel/Symfony), Python (Django/FastAPI) and Docker projects.

- What it does and how it works: [`claude-web-starter/README.md`](claude-web-starter/README.md)
- Internals, CLI contract, Windows porting notes: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## Download
**[Download Sarkhans Claude Starter for Mac](https://github.com/sarkhandigitech/sarkhans-claude-starter-releases/releases/latest/download/Sarkhans-Claude-Starter.dmg)** (always the latest version)

## Requirements
- To use: macOS 13+, Claude Code. Node.js and Git can be installed from inside the app.
- To build the app: Xcode Command Line Tools (`xcode-select --install`).

## For colleagues: install the app
1. Download: https://github.com/sarkhandigitech/sarkhans-claude-starter-releases/releases/latest/download/Sarkhans-Claude-Starter.dmg
2. Open the DMG and drag the app to **Applications**. Without admin rights, use `~/Applications`, the Applications folder in your home folder (create it if it's missing).
3. First open only (the app isn't notarized):
   - macOS 15+: System Settings → Privacy & Security → **Open Anyway**;
   - macOS 13–14: right-click → Open.
4. Follow the setup screen (Node.js, Git, projects folder), select projects and press **Set up**.

No GitHub account or Terminal is needed. The app checks for new versions when it opens. When there's one, an **Update to x.y.z** button appears: it downloads the new version, replaces the app and restarts. If the app's folder needs admin rights, macOS asks for the password.

## Publishing an update
The code stays in this **private** repository. Built apps are published to the **public** repository `sarkhandigitech/sarkhans-claude-starter-releases`, which holds only releases. The download link and the in-app updates point there, so colleagues need no GitHub access.

Releases are automatic. Every merge to `main` that changes `claude-web-starter/VERSION` builds the app on GitHub (Actions → **Release**) and publishes it to the releases repository. Merges that don't change the version publish nothing.

1. Make the change on a branch and bump `claude-web-starter/VERSION`, e.g. `4.5.1` → `4.5.2`.
2. Open a pull request and **Merge** it on GitHub. The commit message becomes the release notes.
3. Wait about 5 minutes. The new version is behind the download link and in everyone's app.

One-time setup, already needed for the first release:
1. Create the public repository `sarkhans-claude-starter-releases` and tick **Add a README file**. Its README is replaced from `releases-repo/README.md` on every release; edit it here, not there.
2. Create a fine-grained personal access token:
   - Repository access: only `sarkhans-claude-starter-releases`;
   - Permissions: **Contents → Read and write**.
3. In this repository, go to Settings → Secrets and variables → Actions → **New repository secret**. Name it `RELEASES_TOKEN` and paste the token. Renew it before it expires.

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
| `.github/workflows/` | automatic release to the public releases repository when `VERSION` changes on `main` |
| `scripts/` | helper scripts |
| `docs/` | architecture and porting guide |
| `releases-repo/` | README of the public download page (`{{VERSION}}`/`{{REPO}}` are filled in on release) |

## Contributing
- Every release bumps `claude-web-starter/VERSION` (app and rules share one version number).
- Test hooks with the stdin examples in `docs/ARCHITECTURE.md`.
- Third-party skills from the catalog are downloaded from their own repositories at install time and keep their own licenses; they are not part of this repository.
