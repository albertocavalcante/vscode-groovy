import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../../utils/logger';

/**
 * Groovy Test Provider for Spock and JUnit tests
 */
export class GroovyTestProvider {
    private testController: vscode.TestController;
    private workspaceRoot: string;

    constructor(context: vscode.ExtensionContext) {
        this.testController = vscode.tests.createTestController('groovyTests', 'Groovy Tests');
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

        context.subscriptions.push(this.testController);

        // Register test run profile
        this.testController.createRunProfile(
            'Run Groovy Tests',
            vscode.TestRunProfileKind.Run,
            this.runHandler.bind(this),
            true
        );

        // Auto-discover tests when files change
        this.setupFileWatcher();

        // Initial test discovery
        this.discoverTests();
    }

    private setupFileWatcher(): void {
        const watcher = vscode.workspace.createFileSystemWatcher('**/*{Spec,Test}.groovy');

        watcher.onDidCreate(uri => this.discoverTestsInFile(uri));
        watcher.onDidChange(uri => this.discoverTestsInFile(uri));
        watcher.onDidDelete(uri => this.removeTestsFromFile(uri));

        this.testController.dispose = () => {
            watcher.dispose();
        };
    }

    private async discoverTests(): Promise<void> {
        if (!this.workspaceRoot) {
            return;
        }

        try {
            const testFiles = await vscode.workspace.findFiles(
                '**/*{Spec,Test}.groovy',
                '**/node_modules/**'
            );

            logger.info(`Discovering tests in ${testFiles.length} files`);

            for (const file of testFiles) {
                await this.discoverTestsInFile(file);
            }
        } catch (error) {
            logger.error(`Error discovering tests: ${error}`);
        }
    }

    private async discoverTestsInFile(uri: vscode.Uri): Promise<void> {
        try {
            const content = fs.readFileSync(uri.fsPath, 'utf8');
            const testInfo = this.parseTestFile(content, uri);

            if (!testInfo) {
                return;
            }

            // Create or update test item for the file
            const fileItem = this.testController.items.get(uri.toString()) ||
                this.testController.createTestItem(uri.toString(), testInfo.className, uri);

            fileItem.label = testInfo.className;
            fileItem.canResolveChildren = true;

            // Clear existing children
            fileItem.children.replace([]);

            // Add test methods
            for (const method of testInfo.methods) {
                const methodId = `${uri.toString()}::${method.name}`;
                const methodItem = this.testController.createTestItem(
                    methodId,
                    method.name,
                    uri
                );

                methodItem.range = method.range;
                methodItem.description = method.description;

                fileItem.children.add(methodItem);
            }

            this.testController.items.add(fileItem);
        } catch (error) {
            logger.error(`Error parsing test file ${uri.fsPath}: ${error}`);
        }
    }

    private removeTestsFromFile(uri: vscode.Uri): void {
        const item = this.testController.items.get(uri.toString());
        if (item) {
            this.testController.items.delete(uri.toString());
        }
    }

    private parseTestFile(content: string, uri: vscode.Uri): TestFileInfo | null {
        const fileName = path.basename(uri.fsPath, '.groovy');

        // Check if it's a Spock specification
        if (content.includes('extends Specification')) {
            return this.parseSpockSpec(content, fileName);
        }

        // Check if it's a JUnit test
        if (content.includes('@Test') || fileName.endsWith('Test')) {
            return this.parseJUnitTest(content, fileName);
        }

        return null;
    }

    private parseSpockSpec(content: string, fileName: string): TestFileInfo {
        const methods: TestMethodInfo[] = [];

        // Match Spock test methods: def "test description"() { ... }
        const spockMethodRegex = /def\s+["']([^"']+)["']\s*\(\s*\)\s*\{/g;
        let match;

        while ((match = spockMethodRegex.exec(content)) !== null) {
            const methodName = match[1];
            const startPos = match.index;
            const lines = content.substring(0, startPos).split('\n');
            const lineNumber = lines.length - 1;

            methods.push({
                name: methodName,
                description: 'Spock specification',
                range: new vscode.Range(lineNumber, 0, lineNumber, match[0].length)
            });
        }

        // Also match setup, cleanup, etc.
        const lifecycleMethodRegex = /def\s+(setup|cleanup|setupSpec|cleanupSpec)\s*\(\s*\)\s*\{/g;
        while ((match = lifecycleMethodRegex.exec(content)) !== null) {
            const methodName = match[1];
            const startPos = match.index;
            const lines = content.substring(0, startPos).split('\n');
            const lineNumber = lines.length - 1;

            methods.push({
                name: methodName,
                description: 'Spock lifecycle method',
                range: new vscode.Range(lineNumber, 0, lineNumber, match[0].length)
            });
        }

        return {
            className: fileName,
            framework: 'Spock',
            methods
        };
    }

    private parseJUnitTest(content: string, fileName: string): TestFileInfo {
        const methods: TestMethodInfo[] = [];

        // Match JUnit test methods: @Test ... def methodName() { ... }
        const junitMethodRegex = /@Test[\\s\\S]*?def\\s+(\\w+)\\s*\\(\\s*\\)/g;
        let match;

        while ((match = junitMethodRegex.exec(content)) !== null) {
            const methodName = match[1];
            const startPos = match.index;
            const lines = content.substring(0, startPos).split('\n');
            const lineNumber = lines.length - 1;

            methods.push({
                name: methodName,
                description: 'JUnit test method',
                range: new vscode.Range(lineNumber, 0, lineNumber, match[0].length)
            });
        }

        return {
            className: fileName,
            framework: 'JUnit',
            methods
        };
    }

    private async runHandler(
        request: vscode.TestRunRequest,
        token: vscode.CancellationToken
    ): Promise<void> {
        const run = this.testController.createTestRun(request);

        try {
            if (request.include) {
                // Run specific tests
                for (const test of request.include) {
                    await this.runTest(test, run, token);
                }
            } else {
                // Run all tests
                for (const [, test] of this.testController.items) {
                    await this.runTest(test, run, token);
                }
            }
        } catch (error) {
            logger.error(`Error running tests: ${error}`);
        } finally {
            run.end();
        }
    }

    private async runTest(
        test: vscode.TestItem,
        run: vscode.TestRun,
        token: vscode.CancellationToken
    ): Promise<void> {
        if (token.isCancellationRequested) {
            return;
        }

        run.started(test);

        try {
            // If this is a file-level test item, run all its children
            if (test.children.size > 0) {
                for (const [, child] of test.children) {
                    await this.runTest(child, run, token);
                }
                return;
            }

            // Run individual test method
            await this.executeTest(test, run);
        } catch (error) {
            run.failed(test, new vscode.TestMessage(`Test execution failed: ${error}`));
        }
    }

    private async executeTest(test: vscode.TestItem, run: vscode.TestRun): Promise<void> {
        if (!test.uri) {
            run.failed(test, new vscode.TestMessage('Test URI not found'));
            return;
        }

        // Extract class and method names
        const [fileId, methodName] = test.id.split('::');
        const uri = vscode.Uri.parse(fileId);
        const className = path.basename(uri.fsPath, '.groovy');

        // Run test via Gradle
        await this.runTestViaGradle(className, methodName, run, test);
    }

    private async runTestViaGradle(
        className: string,
        methodName: string | undefined,
        run: vscode.TestRun,
        test: vscode.TestItem
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            const gradleCommand = this.getGradleCommand();

            let args = ['test'];

            // Add test filter if specific method
            if (methodName) {
                args.push('--tests', `${className}.${methodName}`);
            } else {
                args.push('--tests', className);
            }

            const process = spawn(gradleCommand, args, {
                cwd: this.workspaceRoot,
                shell: true
            });

            let output = '';
            let errorOutput = '';

            process.stdout?.on('data', (data: Buffer) => {
                output += data.toString();
            });

            process.stderr?.on('data', (data: Buffer) => {
                errorOutput += data.toString();
            });

            process.on('close', (code: number) => {
                if (code === 0) {
                    run.passed(test);
                    logger.info(`Test passed: ${test.label}`);
                } else {
                    const message = errorOutput || output || 'Test failed';
                    run.failed(test, new vscode.TestMessage(message));
                    logger.error(`Test failed: ${test.label} - ${message}`);
                }
                resolve();
            });

            process.on('error', (error: Error) => {
                run.failed(test, new vscode.TestMessage(`Test execution error: ${error.message}`));
                reject(error);
            });
        });
    }

    private getGradleCommand(): string {
        const isWindows = process.platform === 'win32';
        const wrapperScript = isWindows ? 'gradlew.bat' : 'gradlew';
        const wrapperPath = path.join(this.workspaceRoot, wrapperScript);

        if (fs.existsSync(wrapperPath)) {
            return isWindows ? wrapperPath : './gradlew';
        }

        return 'gradle';
    }
}

// Interfaces

interface TestFileInfo {
    className: string;
    framework: 'Spock' | 'JUnit';
    methods: TestMethodInfo[];
}

interface TestMethodInfo {
    name: string;
    description: string;
    range: vscode.Range;
}

/**
 * Register the Groovy test provider
 */
export function registerTestProvider(context: vscode.ExtensionContext): void {
    new GroovyTestProvider(context);
}