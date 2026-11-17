# Sarkhans Claude Starter

An Agentic Development Environment for Claude Code: one install adds an orchestrator with specialist agents, strict quality/security/design/database rules enforced by hooks, and a catalog of design skills — for TypeScript/Next.js, Go, PHP (Laravel/Symfony), Python (Django/FastAPI) and Docker projects.

- What it does and how it works: [`claude-web-starter/README.md`](claude-web-starter/README.md)
- Internals, CLI contract, Windows porting notes: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## Requirements
- To use: macOS 13+, Claude Code. Node.js and Git can be installed from inside the app.
- To build the app: Xcode Command Line Tools (`xcode-select --install`).

## For colleagues: install the app
1. Open the repository's **Releases** page and download `Sarkhans-Claude-Starter.dmg` from the latest release.
2. Drag the app to Applications and open it.
3. First open only (the app isn't notarized):
   - macOS 15+: System Settings → Privacy & Security → **Open Anyway**;
   - macOS 13–14: right-click → Open.
4. Follow the setup screen (Node.js, Git, projects folder), select projects and press **Set up**.

From then on the app checks for new releases when it opens. When there's one, an **Update to x.y.z** button appears in the toolbar: it downloads the release, replaces the app and restarts. For a **private** repository each person needs read access. Either they're signed in with GitHub CLI (`gh auth login`), or they paste a fine-grained token (Contents: read) into Settings → Updates; it's stored in the Keychain.

## Publishing an update
1. Change what you need. Bump `claude-web-starter/VERSION`, e.g. `4.5.0` → `4.6.0`; the app version is the same number.
2. Commit and push (through a pull request if `main` is protected).
3. Tag the release: `git tag v4.6.0 && git push origin v4.6.0`.

GitHub Actions (`.github/workflows/release.yml`) builds the universal app on macOS and publishes a release with:
- `Sarkhans-Claude-Starter.dmg`, the installer for new people;
- `Sarkhans-Claude-Starter.zip`, the package the app updates itself from.

The update source is filled in automatically from the repository name. Everyone sees the update the next time they open the app. Their projects then show "Update available" for the new rules.

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
| `.github/workflows/` | release build on every `v*` tag |
| `scripts/` | helper scripts |
| `docs/` | architecture and porting guide |

## Contributing
- Every release bumps `claude-web-starter/VERSION` (app and rules share one version number).
- Test hooks with the stdin examples in `docs/ARCHITECTURE.md`.
- Third-party skills from the catalog are downloaded from their own repositories at install time and keep their own licenses; they are not part of this repository.
