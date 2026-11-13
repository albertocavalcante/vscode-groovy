# VS Code Marketplace Publishing Setup

This guide walks you through setting up automated publishing to the VS Code Marketplace using GitHub Actions.

## Prerequisites

- Extension is ready for publishing (tested, documented, proper version)
- GitHub repository with publish workflow configured
- VS Code Marketplace publisher account

## Step 1: Create VS Code Marketplace Account

1. **Visit the Marketplace**
   - Go to [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/)
   - Sign in with your Microsoft account

2. **Create Publisher**
   - Go to [Manage Publishers](https://marketplace.visualstudio.com/manage/publishers)
   - Click "Create publisher" if you don't have one
   - Choose a unique publisher ID (cannot be changed later)
   - Fill in display name and description

## Step 2: Generate Personal Access Token

1. **Access Token Management**
   - Stay on the [Manage Publishers](https://marketplace.visualstudio.com/manage/publishers) page
   - Click on your publisher name
   - Go to "Personal Access Tokens" tab

2. **Create New Token**
   - Click "New Token"
   - **Name**: `vscode-groovy-extension` (or descriptive name)
   - **Organization**: Select "All accessible organizations"
   - **Expiration**: Choose appropriate duration (recommend 1 year)
   - **Scopes**: Select "Marketplace (Publish)"

3. **Save the Token**
   - **IMPORTANT**: Copy the token immediately - it won't be shown again
   - Store it securely (you'll add it to GitHub secrets next)

## Step 3: Configure GitHub Repository Secrets

1. **Access Repository Settings**
   - Go to your GitHub repository: `https://github.com/albertocavalcante/vscode-groovy`
   - Click "Settings" tab
   - Click "Secrets and variables" → "Actions"

2. **Add VSCE_TOKEN Secret**
   - Click "New repository secret"
   - **Name**: `VSCE_TOKEN`
   - **Secret**: Paste your Personal Access Token from Step 2
   - Click "Add secret"

## Step 4: (Optional) Open VSX Registry Setup

The Open VSX Registry is an open-source alternative marketplace used by VS Code alternatives like VSCodium.

1. **Create Account**
   - Go to [Open VSX Registry](https://open-vsx.org/)
   - Sign in with GitHub

2. **Create Namespace**
   - Go to [User Settings](https://open-vsx.org/user-settings/namespaces)
   - Create a namespace (should match your publisher ID)

3. **Generate Access Token**
   - Go to [Access Tokens](https://open-vsx.org/user-settings/tokens)
   - Click "Generate New Token"
   - **Description**: `vscode-groovy-extension`
   - Copy the generated token

4. **Add to GitHub Secrets**
   - In your GitHub repository secrets
   - **Name**: `OVSX_TOKEN`
   - **Secret**: Paste your Open VSX token

## Step 5: Verify Configuration

1. **Check Package.json**
   Ensure your `package.json` has the correct publisher:
   ```json
   {
     "publisher": "albertocavalcante",
     "repository": {
       "type": "git",
       "url": "https://github.com/albertocavalcante/vscode-groovy.git"
     }
   }
   ```

2. **Review Publish Workflow**
   The `.github/workflows/publish.yml` should reference your secrets:
   ```yaml
   env:
     VSCE_TOKEN: ${{ secrets.VSCE_TOKEN }}
     OVSX_TOKEN: ${{ secrets.OVSX_TOKEN }}  # Optional
   ```

## Step 6: Test Publishing Process

### Local Testing (Recommended First)

1. **Install vsce globally**
   ```bash
   npm install -g @vscode/vsce
   ```

2. **Login with your token**
   ```bash
   vsce login albertocavalcante
   ```
   - Enter your Personal Access Token when prompted

3. **Verify package**
   ```bash
   vsce package
   vsce ls
   ```

4. **Test publish (dry run)**
   ```bash
   vsce publish --dry-run
   ```

### Automated Publishing

The extension will be automatically published when:

1. **Release Please creates a release**
   - Merge commits to main with conventional commit messages
   - Release Please will create/update a release PR
   - Review the generated version and changelog

2. **Merge the Release PR**
   - When you merge the Release Please PR
   - A GitHub release is created automatically
   - The publish workflow triggers automatically

3. **Monitor the workflow**
   - Go to GitHub Actions tab in your repository
   - Watch the "Publish" workflow execution
   - Check for any errors in the logs

## Troubleshooting

### Common Issues

1. **Invalid Token Error**
   - Verify token was copied correctly
   - Check token hasn't expired
   - Ensure correct scopes are selected

2. **Publisher Mismatch**
   - Verify `package.json` publisher matches your marketplace publisher ID
   - Publisher ID is case-sensitive

3. **Version Already Exists**
   - VS Code Marketplace doesn't allow republishing same version
   - Increment version in `package.json` or use Release Please

4. **Package Too Large**
   - Check bundle size (should be under 50MB)
   - Review `.vscodeignore` to exclude unnecessary files
   - Consider optimizing dependencies

### Validation Commands

```bash
# Check current version
vsce show albertocavalcante.vscode-groovy

# Verify package contents
vsce ls --tree

# Test authentication
vsce verify-pat albertocavalcante
```

## Security Best Practices

1. **Token Management**
   - Set appropriate expiration dates
   - Rotate tokens regularly
   - Never commit tokens to source code
   - Use repository secrets, not environment variables

2. **Repository Access**
   - Limit who has access to repository secrets
   - Review collaborator permissions
   - Monitor Actions workflow runs

3. **Publishing Safety**
   - Always test locally before automated publishing
   - Review Release Please PRs carefully
   - Monitor extension downloads and feedback

## Maintenance

### Regular Tasks

1. **Token Renewal**
   - Monitor token expiration dates
   - Update GitHub secrets when tokens are renewed
   - Test publishing after token updates

2. **Marketplace Management**
   - Monitor extension ratings and reviews
   - Keep extension description and screenshots updated
   - Respond to user feedback promptly

3. **Version Management**
   - Follow semantic versioning
   - Use conventional commits for automatic versioning
   - Maintain clear changelog entries

## Resources

- [VS Code Extension Publishing Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce CLI Reference](https://github.com/microsoft/vscode-vsce)
- [Open VSX Publishing](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)
- [Release Please Documentation](https://github.com/googleapis/release-please)

---

For additional help, see the main [CI/CD Setup Guide](.github/CI_CD_SETUP.md) or open an issue on GitHub.