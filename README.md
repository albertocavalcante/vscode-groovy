# Groovy Language Support

[![CI](https://github.com/albertocavalcante/vscode-groovy/actions/workflows/main.yml/badge.svg)](https://github.com/albertocavalcante/vscode-groovy/actions/workflows/main.yml)

A comprehensive VS Code extension that adds professional-grade Groovy language support with intelligent code completion, real-time error detection, and advanced compilation features.

> **Status:** Stable release - actively maintained and ready for production use.

## ✨ Features

### Core Language Support
- [x] **Syntax highlighting** for all Groovy file types
- [x] **IntelliSense & code completion** with context-aware suggestions
- [x] **Real-time error detection** and diagnostics
- [x] **Hover documentation** for methods, classes, and variables
- [x] **Go to definition** and symbol navigation
- [x] **Automatic imports** organization and management

### Advanced Features
- [x] **Workspace compilation** with cross-file resolution
- [x] **Incremental compilation** for optimal performance
- [x] **Gradle integration** with build file parsing
- [x] **Jenkins Pipeline** support with Jenkinsfile syntax
- [x] **Custom compilation modes** for different project sizes
- [x] **Air-gapped environment** support for enterprise deployments

### Gradle & Build Integration
- [x] **Gradle project detection** and configuration
- [x] **Build task execution** from VS Code
- [x] **Dependency management** and analysis
- [x] **Multi-module project** support

## 📁 Supported Files

| File Type | Extensions | Description |
|-----------|------------|-------------|
| **Groovy Scripts** | `.groovy`, `.gvy`, `.gy`, `.gsh` | General Groovy code and scripts |
| **Gradle Build** | `.gradle`, `.gradle.kts` | Gradle build scripts (Groovy & Kotlin DSL) |
| **Jenkins Pipeline** | `Jenkinsfile`, `Jenkinsfile.*`, `*.jenkins` | CI/CD pipeline definitions |

## 🚀 Quick Start

**Prerequisites:** Java 17+ installed on your system.

1. **Install** this extension from the VS Code Marketplace
2. **Open** any Groovy file (`.groovy`, `.gradle`, or `Jenkinsfile`)
3. **Start coding** - language support activates automatically!

The extension automatically discovers Java from your `PATH` or `JAVA_HOME` environment variable.

## ⚙️ Configuration

The extension provides comprehensive configuration options to customize your Groovy development experience.

### Java Settings

```json
{
  "groovy.java.home": "/path/to/your/java17"
}
```

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `groovy.java.home` | string | `undefined` | Path to Java installation (requires Java 17+). If not set, uses `PATH` or `JAVA_HOME`. |

### Language Server Settings

```json
{
  "groovy.trace.server": "verbose",
  "groovy.server.maxNumberOfProblems": 200,
  "groovy.server.downloadUrl": "https://nexus.company.com/groovy-lsp.jar"
}
```

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `groovy.trace.server` | enum | `"off"` | Trace communication with language server. Options: `"off"`, `"messages"`, `"verbose"` |
| `groovy.server.maxNumberOfProblems` | number | `100` | Maximum number of problems/diagnostics shown per file |
| `groovy.server.downloadUrl` | string | `undefined` | Custom URL for downloading language server JAR (for air-gapped environments) |

### Compilation Settings

```json
{
  "groovy.compilation.mode": "workspace",
  "groovy.compilation.incrementalThreshold": 25,
  "groovy.compilation.maxWorkspaceFiles": 1000
}
```

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `groovy.compilation.mode` | enum | `"workspace"` | Compilation strategy: `"workspace"` (cross-file resolution) or `"single-file"` (faster, isolated) |
| `groovy.compilation.incrementalThreshold` | number | `50` | File count threshold for incremental vs full compilation |
| `groovy.compilation.maxWorkspaceFiles` | number | `500` | Maximum files compiled together in workspace mode |

### Enterprise & Air-gapped Environments

For corporate networks or air-gapped environments, you can specify custom download sources:

```json
{
  "groovy.server.downloadUrl": "https://artifacts.company.com/groovy-lsp.jar"
}
```

Or use environment variables during extension installation:
```bash
GROOVY_LSP_DOWNLOAD_URL="https://nexus.company.com/groovy-lsp.jar" code --install-extension albertocavalcante.vscode-groovy
```

## 🎯 Commands

Access these commands via Command Palette (`Cmd/Ctrl+Shift+P`):

### Core Commands
- **`Groovy: Restart Language Server`** - Restart the language server if issues occur
- **`Groovy: Organize Imports`** - Clean up and organize import statements
- **`Groovy: Generate Getter and Setter`** - Generate accessor methods for properties
- **`Groovy: Convert String Type`** - Convert between string literal types
- **`Groovy: Add @CompileStatic`** - Add compile-time checking annotation

### Gradle Commands
- **`Gradle: Build`** - Execute Gradle build
- **`Gradle: Test`** - Run Gradle tests
- **`Gradle: Clean`** - Clean build artifacts
- **`Gradle: Select and Run Task`** - Pick and execute any Gradle task
- **`Gradle: Show Dependencies`** - Display project dependencies
- **`Gradle: Refresh Project`** - Refresh Gradle project configuration
- **`Gradle: Show Project Info`** - View project information and structure

### Testing Commands
- **`Groovy: Run Tests in File`** - Execute all tests in current file
- **`Groovy: Run All Tests`** - Run entire test suite
- **`Groovy: Run Test at Cursor`** - Run specific test under cursor
- **`Groovy: Discover Tests`** - Scan for test files and methods
- **`Groovy: Create Spock Test`** - Generate new Spock test template

## 🔧 Troubleshooting

### Common Issues

**🚫 Extension not working?**
1. **Check Java version:** `java -version` (requires Java 17+)
2. **Restart language server:** `Cmd/Ctrl+Shift+P` → "Groovy: Restart Language Server"
3. **Check output logs:** View → Output → "Groovy Language Server"
4. **Verify Java path:** Set `groovy.java.home` if Java isn't in PATH

**📄 File not recognized as Groovy?**
- Ensure file has supported extension: `.groovy`, `.gvy`, `.gy`, `.gsh`, `.gradle`
- For Jenkins files: name it `Jenkinsfile` or use `.jenkins` extension
- Check file association in VS Code: bottom-right language selector

**🐛 Performance issues?**
- For large projects: Set `groovy.compilation.mode` to `"single-file"`
- Adjust `groovy.compilation.maxWorkspaceFiles` limit
- Enable incremental compilation with lower threshold

**🌐 Air-gapped/Corporate environment?**
- Configure `groovy.server.downloadUrl` for custom JAR source
- Use `GROOVY_LSP_DOWNLOAD_URL` environment variable
- Contact IT for artifact repository access

### Debug Information

Enable verbose logging for detailed troubleshooting:
```json
{
  "groovy.trace.server": "verbose"
}
```

Check these output channels:
- **Groovy Extension** - Extension lifecycle and configuration
- **Groovy Language Server** - LSP communication and errors
- **Groovy Language Server Trace** - Detailed LSP protocol messages

## 🏗️ Development

Ready to contribute? Check out our [Contributing Guide](CONTRIBUTING.md) for setup instructions and development guidelines.

```bash
# Quick start for contributors
git clone https://github.com/albertocavalcante/vscode-groovy.git
cd vscode-groovy
npm install
npm run compile
```

### Project Structure
```
vscode-groovy/
├── client/           # VS Code extension client
├── server/          # Language server JAR location
├── scripts/         # Build and setup scripts
├── syntaxes/        # TextMate grammar files
└── snippets/        # Code snippets
```

## 🤝 Contributing

We welcome contributions! Whether you're fixing bugs, adding features, or improving documentation:

- 🐛 **Bug reports:** [Create an issue](https://github.com/albertocavalcante/vscode-groovy/issues/new)
- 💡 **Feature requests:** [Start a discussion](https://github.com/albertocavalcante/vscode-groovy/discussions)
- 🔧 **Pull requests:** See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines

## 📚 Resources

- **[Language Server](https://github.com/albertocavalcante/groovy-lsp)** - The underlying Groovy Language Server
- **[Groovy Documentation](https://groovy-lang.org/documentation.html)** - Official Groovy docs
- **[Gradle User Guide](https://docs.gradle.org/current/userguide/userguide.html)** - Gradle build tool
- **[Jenkins Pipeline](https://www.jenkins.io/doc/book/pipeline/)** - Jenkins pipeline documentation

## 📄 License

This extension is licensed under the [Apache-2.0 License](LICENSE).

---

**🔗 Links:** [GitHub](https://github.com/albertocavalcante/vscode-groovy) • [Issues](https://github.com/albertocavalcante/vscode-groovy/issues) • [Marketplace](https://marketplace.visualstudio.com/items?itemName=albertocavalcante.vscode-groovy) • [Language Server](https://github.com/albertocavalcante/groovy-lsp)