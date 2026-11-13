# CI/CD Setup Guide

## Overview

This extension uses GitHub Actions with Release Please for automated version management and publishing.

## Workflows

### 1. PR Check (`.github/workflows/pr.yml`)
- **Trigger**: Pull requests
- **Purpose**: Quick validation (Linux only, ~30-60 seconds)
- **Actions**: Lint, type check, build, bundle size check

### 2. Main CI (`.github/workflows/main.yml`)
- **Trigger**: Pushes to main branch
- **Purpose**: Full testing across platforms
- **Actions**: Test on Ubuntu, Windows, and macOS

### 3. Release Please (`.github/workflows/release-please.yml`)
- **Trigger**: Pushes to main branch
- **Purpose**: Automated version management
- **Actions**: Creates/updates release PRs based on conventional commits

### 4. Publish (`.github/workflows/publish.yml`)
- **Trigger**: GitHub release published
- **Purpose**: Publish to VS Code Marketplace
- **Actions**: Build and publish extension

## Using Conventional Commits

Use conventional commit format for automatic version bumping:

```bash
# New feature (minor version)
git commit -m "feat: add Gradle task provider"

# Bug fix (patch version)
git commit -m "fix: resolve Java detection on Windows"

# Breaking change (major version)
git commit -m "feat!: refactor extension API"

# Other types (no version bump)
git commit -m "docs: update README"
git commit -m "chore: update dependencies"
```

## Release Process

1. **Develop**: Make changes using conventional commits
2. **Automatic**: Release Please creates/updates PR with version bump
3. **Review**: Check the generated changelog and version
4. **Merge**: Merge the Release Please PR
5. **Automatic**: Release is created and extension published

## Required Secrets

Add these to your GitHub repository secrets:

### `VSCE_TOKEN`
1. Go to https://marketplace.visualstudio.com/manage/publishers
2. Create a new Personal Access Token
3. Scope: `Marketplace (Publish)`
4. Add as repository secret

### `OVSX_TOKEN` (Optional)
1. Go to https://open-vsx.org/user-settings/tokens
2. Create access token
3. Ensure your namespace exists
4. Add as repository secret

## Cost Efficiency

- **PR checks**: Linux only (~100 minutes/month)
- **Main branch**: Multi-OS only when needed (~780 minutes/month)
- **Total**: ~900 minutes/month (45% of GitHub's 2000 free minutes)

## Configuration Files

- `release-please-config.json`: Release Please configuration
- `.release-please-manifest.json`: Current version tracking
- `commitlint.config.js`: Conventional commit rules (optional)

## Manual Testing

You can test workflows manually:

```bash
# Trigger release-please manually
gh workflow run release-please.yml

# Check workflow status
gh run list --workflow=pr.yml
```

## Troubleshooting

### Bundle Size Error
If PR checks fail due to bundle size:
1. Check what's included in the bundle
2. Consider excluding unnecessary files
3. Optimize dependencies

### Java Issues
If Java setup fails:
1. Verify Java 17+ is configured
2. Check the Groovy LSP download works
3. Review error logs in Actions

### Publishing Failures
If publishing fails:
1. Verify VSCE_TOKEN is correct
2. Check marketplace permissions
3. Ensure version doesn't already exist

## Adding More Workflows

To add more complex testing, security scanning, or other features:

1. Create new workflow files in `.github/workflows/`
2. Follow existing patterns
3. Keep cost efficiency in mind
4. Test on feature branches first