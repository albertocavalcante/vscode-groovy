# Changelog

All notable changes to the "Groovy Language Support" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-09-25

### Added

- **Initial release** of Groovy Language Support for VS Code
- **Language Server Integration** with dedicated Groovy Language Server
- **Comprehensive file support**:
  - Groovy scripts (`.groovy`, `.gvy`, `.gy`, `.gsh`)
  - Gradle build files (`.gradle`)
  - Jenkins Pipeline files (`Jenkinsfile`, `Jenkinsfile.*`)
- **Language features**:
  - Syntax highlighting with rich TextMate grammar
  - Code completion and IntelliSense
  - Real-time diagnostics and error reporting
  - Hover information and documentation
  - Symbol navigation and outline
- **Configuration options**:
  - Custom Java home path (`groovy.java.home`)
  - Language server trace levels
  - Maximum number of problems display limit
- **Commands**:
  - `Groovy: Restart Server` for manual server management
- **Status bar integration** showing language server status
- **Automatic Java detection** with fallback hierarchy:
  1. User-configured `groovy.java.home` setting
  2. `JAVA_HOME` environment variable
  3. System PATH Java installation
- **Robust error handling** with helpful user messages
- **Multi-platform support** (Windows, macOS, Linux)
- **Automated CI/CD pipeline**:
  - Pull request validation
  - Multi-platform testing
  - Automated releases with Release Please
  - VS Code Marketplace publishing

### Technical Details

- **Architecture**: Modern modular design with domain-driven structure
- **Bundle optimization**: esbuild-powered bundling for performance
- **Language Server**: Automatic JAR downloading and management
- **Development**: Comprehensive development setup with TypeScript, ESLint
- **Testing**: Extension Development Host integration for local testing
- **Requirements**:
  - VS Code 1.100.0+
  - Java 17+ runtime

---

## Release Process

This project uses [Release Please](https://github.com/googleapis/release-please) for automated version management and changelog generation based on [Conventional Commits](https://www.conventionalcommits.org/).

### Commit Types

- `feat:` New features (minor version bump)
- `fix:` Bug fixes (patch version bump)
- `feat!:` or `fix!:` Breaking changes (major version bump)
- `docs:`, `chore:`, `refactor:`, `test:` No version bump

## Links

- [GitHub Repository](https://github.com/albertocavalcante/vscode-groovy)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=albertocavalcante.vscode-groovy)
- [Issue Tracker](https://github.com/albertocavalcante/vscode-groovy/issues)