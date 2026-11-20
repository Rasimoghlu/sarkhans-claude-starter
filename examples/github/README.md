# Security review on every pull request

`security-review.yml` runs Anthropic's official [Claude Code Security Reviewer](https://github.com/anthropics/claude-code-security-review) on each pull request and leaves comments where it finds a problem. It reads the code changes; it doesn't attack a running app (that's `/pentest`).

1. Copy `security-review.yml` into your project as `.github/workflows/security-review.yml`.
2. In the repository on GitHub: Settings → Secrets and variables → Actions → New repository secret, name `CLAUDE_API_KEY`, value an Anthropic API key that is enabled for the Claude API and Claude Code. It is billed through your API account, not your Claude subscription.
3. Open a pull request. The review appears as comments after a few minutes.

Good to know:
- The action is not hardened against prompt injection, so it should only review trusted pull requests. This workflow runs only for pull requests from branches of the same repository, not from forks.
- For public repositories, also turn on Settings → Actions → General → "Require approval for all external contributors".
- The same review runs locally with `/security-review` in Claude Code, without any setup.
