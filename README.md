# Sarkhans Claude Starter

An Agentic Development Environment for Claude Code: one install adds an orchestrator with specialist agents, strict quality/security/design/database rules enforced by hooks, and a catalog of design skills — for projects in any language, with extra support for TypeScript/Next.js, Go, PHP (Laravel/Symfony), Python (Django/FastAPI), Rust, Java/Kotlin, .NET, Ruby, Dart/Flutter, Swift and Docker.

## ⬇️ Download
### [Download Sarkhans Claude Starter for Mac](https://github.com/sarkhandigitech/sarkhans-claude-starter/releases/latest/download/Sarkhans-Claude-Starter.dmg)
macOS 13 or newer · Apple Silicon and Intel · always the latest version · [how to install](#install-on-a-mac)

- What it does and how it works: [`claude-web-starter/README.md`](claude-web-starter/README.md)
- Internals, CLI contract, Windows porting notes: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## Requirements
- To use: macOS 13+, Claude Code. Node.js and Git can be installed from inside the app.
- To build the app: Xcode Command Line Tools (`xcode-select --install`).

## Install on a Mac

### 1. Put the app in Applications
Open the downloaded `Sarkhans-Claude-Starter.dmg` and drag **Sarkhans Claude Starter** onto the **Applications** folder.
If your Mac account has no admin rights, drag it into the **Applications** folder inside your home folder instead (Finder → Go → Home; create a folder named `Applications` if it isn't there).

### 2. Allow it once
The app isn't notarized by Apple (that needs a paid Apple developer account). That's why macOS asks you to confirm it **once**, the first time you open it. Apps from developers who pay Apple for notarization show a simple **Open** button instead.

**macOS 15 Sequoia and macOS 26 Tahoe**
1. Double-click **Sarkhans Claude Starter** in Applications. macOS shows *"Sarkhans Claude Starter" Not Opened*. Click **Done**, not Move to Trash.
2. Open the **Apple menu** → **System Settings** → **Privacy & Security**.
3. Scroll all the way down to **Security**. Next to *"Sarkhans Claude Starter" was blocked to protect your Mac* click **Open Anyway**.
4. In the next window click **Open Anyway** again and confirm with your password or Touch ID. The app opens.

The **Open Anyway** button appears only after step 1 and stays for about an hour. If you don't see it, do step 1 again.

**macOS 13 Ventura and macOS 14 Sonoma**
Right-click (or Control-click) the app in Applications → **Open** → **Open**.

After this, the app opens normally with a double-click. Updates install themselves from inside the app and don't ask again.

### 3. Set it up
The app opens a short setup screen:
- **Node.js** and **Git**: press the button if one is missing and finish the installer.
- **Projects folder**: choose the folder with your projects.
- **Claude's language**: the language Claude explains things in.

Then select your projects and press **Set up**. You also need [Claude Code](https://docs.claude.com/en/docs/claude-code/overview).

### Updates
The app checks for new versions when it opens, every 30 minutes, and when you switch back to it. When one is available, an **Update to x.y.z** button appears: it downloads the new version, replaces the app and restarts. If the app's folder needs admin rights, macOS asks for your password. Set-up projects get new rules automatically.

### For developers: install from Terminal
If you're comfortable with Terminal, this one line installs or reinstalls the latest version without the approval step:
```bash
curl -fsSL https://raw.githubusercontent.com/sarkhandigitech/sarkhans-claude-starter/main/install.sh | bash
```

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
