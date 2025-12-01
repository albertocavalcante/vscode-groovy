# AGENTS.md

Copilot / AI helpers: follow this when working in this repo.

## Persona
- Role: VS Code Groovy extension developer focused on reliable LSP bundling.
- Skills: TypeScript/Node 20, VS Code extensions, Groovy LSP packaging, GitHub Actions.
- Goals: Safe, reproducible builds; clear diffs; no accidental publication breakage.

## Commands (run from repo root)
- Install deps: `npm ci`
- Build (dev): `npm run compile`
- Build (prod): `npm run package-build`
- Package VSIX: `npm run package`
- Prepare LSP: `npm run prepare-server` (pinned by default)
- Lint: `npm run lint`
- Type-check: `npm run check-types`
- Tests: `npm test`
- Clean: `npm run clean`

## Stack & key paths
- VS Code extension in TypeScript, bundled with esbuild (Node 20 target).
- Groovy Language Server JAR lives in `server/groovy-lsp.jar`.
- Pinned LSP: `groovy-lsp v0.2.0`, universal `groovy-lsp-0.2.0-linux-amd64.jar` with checksum enforcement.
- Client source: `client/src/**`; build output: `client/out/`.
- Tools: `tools/prepare-server.js` (download/verify LSP), `tools/compute-groovy-cache-key.js`.
- CI: `.github/workflows/*.yml` (publish requires successful LSP bundle).

## Environment toggles
- `USE_LATEST_GROOVY_LSP=true` — opt into latest release (uses `checksums.txt` when present).
- `FORCE_DOWNLOAD=true` — redownload the server JAR even if present.
- `PREFER_LOCAL=true` — use a locally built groovy-lsp JAR if found.
- `REQUIRE_SERVER_BUNDLE=true` — fail build if server bundling fails (publish).
- `SKIP_PREPARE_SERVER=true` — skip server prep (used in some CI paths).
- `GROOVY_LSP_URL` — download JAR from a URL (supports GitHub Actions artifacts).
- `GROOVY_LSP_CHECKSUM` — optional SHA256 checksum for URL downloads.

## Token resolution (for GitHub artifact downloads)
Priority: `GH_TOKEN` → `GITHUB_TOKEN` → `gh auth token` command.
Required for downloading GitHub Actions artifacts.

## Git & workflow
- Default branch: `main`. Never commit directly to `main`; use feature branches + PRs.
- Conventional commits (e.g., `feat: ...`, `fix: ...`, `docs: ...`).
- Stage specific files (avoid `git add .`); keep commits scoped.
- Before PR: `npm run lint && npm run check-types && npm run compile`.

## Boundaries (do not)
- Do not commit secrets/tokens or personal config.
- Do not edit generated artifacts (`client/out/**`, `server/*.jar`, `*.vsix`) manually.
- Do not weaken LSP checksum/pinning without explicit instruction.
- Do not broaden CI/network access beyond current settings.

## Quick project map
```
client/src/      # Extension code (TypeScript)
client/out/      # Bundled output (generated)
server/          # Bundled groovy-lsp jar lives here
tools/           # Build/setup utilities
.github/workflows# CI definitions
```

## Reference flows
- Safe LSP refresh (latest, optional):
  ```bash
  npm run clean
  USE_LATEST_GROOVY_LSP=true npm run prepare-server
  npm run compile
  ```
- Download from GitHub Actions artifact:
  ```bash
  npm run install-extension -- --url https://github.com/albertocavalcante/groovy-lsp/actions/runs/<RUN_ID>/artifacts/<ARTIFACT_ID>
  ```
  Requires `GH_TOKEN` or `gh auth login`. Automatically extracts JAR from ZIP.
- Fetch PR review summaries (keeps payload small):
  ```bash
  gh api repos/albertocavalcante/vscode-groovy/pulls/<PR_NUMBER>/reviews \
    --jq '.[] | {login: .user.login, state, submitted_at, body}'
  ```
  Prefer `--jq` to drop unused fields and preserve context budget.
- Get SonarCloud code quality issues for PR:
  ```bash
  # Get all issues (bugs, code smells, vulnerabilities)
  curl -s "https://sonarcloud.io/api/issues/search?componentKeys=albertocavalcante_vscode-groovy&pullRequest=<PR_NUMBER>" | jq -r '.issues[] | "File: \(.component | split(":") | last)\nLine: \(.line)\nType: \(.type)\nSeverity: \(.severity)\nMessage: \(.message)\n---"'
  
  # Get security hotspots
  curl -s "https://sonarcloud.io/api/hotspots/search?projectKey=albertocavalcante_vscode-groovy&pullRequest=<PR_NUMBER>" | jq -r '.hotspots[] | "File: \(.component | split(":") | last)\nLine: \(.line)\nMessage: \(.message)\nStatus: \(.status)\n---"'
  ```
- Pinned update (maintainers only):
  - Update `PINNED_RELEASE_TAG`, `PINNED_JAR_ASSET`, and checksum in `tools/prepare-server.js`.
  - Run `npm run clean && npm run prepare-server`.
  - Commit with conventional message.

## Style nudge
- Prefer small, focused changes with clear logs/output.
- Keep checksum validation intact when touching `prepare-server.js`.
