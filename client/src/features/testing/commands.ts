import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { GradleUtils } from '../gradle/utils';

/**
 * Run all tests in the current file
 */
export async function runTestsInFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor found');
        return;
    }

    const document = editor.document;
    if (!isTestFile(document)) {
        vscode.window.showWarningMessage('Current file is not a test file');
        return;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
        vscode.window.showWarningMessage('File is not in a workspace');
        return;
    }

    try {
        const className = path.basename(document.fileName, '.groovy');
        await runTestClass(className, workspaceFolder);
        logger.info(`Running tests in ${className}`);
    } catch (error) {
        logger.error(`Error running tests in file: ${error}`);
        vscode.window.showErrorMessage('Failed to run tests in current file');
    }
}

/**
 * Run all tests in the workspace
 */
export async function runAllTests(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showWarningMessage('No workspace folder found');
        return;
    }

    if (!GradleUtils.isGradleProject(workspaceFolder)) {
        vscode.window.showWarningMessage('Current workspace is not a Gradle project');
        return;
    }

    try {
        await GradleUtils.runGradleTask('test', workspaceFolder);
        logger.info('Running all tests');
    } catch (error) {
        logger.error(`Error running all tests: ${error}`);
        vscode.window.showErrorMessage('Failed to run all tests');
    }
}

/**
 * Run test at cursor position
 */
export async function runTestAtCursor(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor found');
        return;
    }

    const document = editor.document;
    if (!isTestFile(document)) {
        vscode.window.showWarningMessage('Current file is not a test file');
        return;
    }

    const position = editor.selection.active;
    const testMethod = findTestMethodAtPosition(document, position);

    if (!testMethod) {
        vscode.window.showWarningMessage('No test method found at cursor position');
        return;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
        vscode.window.showWarningMessage('File is not in a workspace');
        return;
    }

    try {
        const className = path.basename(document.fileName, '.groovy');
        await runTestMethod(className, testMethod, workspaceFolder);
        logger.info(`Running test method: ${testMethod}`);
    } catch (error) {
        logger.error(`Error running test at cursor: ${error}`);
        vscode.window.showErrorMessage('Failed to run test method');
    }
}

/**
 * Discover and show all tests in workspace
 */
export async function discoverTests(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showWarningMessage('No workspace folder found');
        return;
    }

    try {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Discovering tests...',
            cancellable: false
        }, async () => {
            const testFiles = await vscode.workspace.findFiles(
                '**/*{Spec,Test}.groovy',
                '**/node_modules/**'
            );

            const testInfo: TestDiscoveryInfo[] = [];

            for (const file of testFiles) {
                const content = await vscode.workspace.fs.readFile(file);
                const contentStr = content.toString();
                const info = parseTestFileForDiscovery(contentStr, file);
                if (info) {
                    testInfo.push(info);
                }
            }

            await showTestDiscoveryResults(testInfo);
        });
    } catch (error) {
        logger.error(`Error discovering tests: ${error}`);
        vscode.window.showErrorMessage('Failed to discover tests');
    }
}

/**
 * Create a new Spock test class
 */
export async function createSpockTest(): Promise<void> {
    const className = await vscode.window.showInputBox({
        prompt: 'Enter test class name (without Spec suffix)',
        placeHolder: 'MyClass'
    });

    if (!className) {
        return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showWarningMessage('No workspace folder found');
        return;
    }

    try {
        const testContent = generateSpockTestTemplate(className);
        const fileName = `${className}Spec.groovy`;
        const filePath = vscode.Uri.joinPath(workspaceFolder.uri, 'src', 'test', 'groovy', fileName);

        await vscode.workspace.fs.writeFile(filePath, Buffer.from(testContent));
        const document = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(document);

        logger.info(`Created Spock test: ${fileName}`);
    } catch (error) {
        logger.error(`Error creating Spock test: ${error}`);
        vscode.window.showErrorMessage('Failed to create Spock test');
    }
}

// Helper functions

function isTestFile(document: vscode.TextDocument): boolean {
    const fileName = path.basename(document.fileName);
    return fileName.endsWith('Spec.groovy') || fileName.endsWith('Test.groovy');
}

function findTestMethodAtPosition(document: vscode.TextDocument, position: vscode.Position): string | null {
    const text = document.getText();
    const lines = text.split('\n');

    // Look backwards from cursor position to find test method
    for (let i = position.line; i >= 0; i--) {
        const line = lines[i];

        // Spock test method
        const spockMatch = line.match(/def\s+["']([^"']+)["']\s*\(\s*\)/);
        if (spockMatch) {
            return spockMatch[1];
        }

        // JUnit test method
        const junitMatch = line.match(/def\s+(\w+)\s*\(\s*\)/);
        if (junitMatch && i > 0) {
            // Check if previous line has @Test
            const prevLine = lines[i - 1];
            if (prevLine.includes('@Test')) {
                return junitMatch[1];
            }
        }
    }

    return null;
}

async function runTestClass(className: string, workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    const gradleCommand = GradleUtils.getGradleCommand(workspaceFolder);

    const terminal = vscode.window.createTerminal({
        name: `Test: ${className}`,
        cwd: workspaceFolder.uri.fsPath
    });

    terminal.sendText(`${gradleCommand} test --tests ${className}`);
    terminal.show();
}

async function runTestMethod(
    className: string,
    methodName: string,
    workspaceFolder: vscode.WorkspaceFolder
): Promise<void> {
    const gradleCommand = GradleUtils.getGradleCommand(workspaceFolder);

    const terminal = vscode.window.createTerminal({
        name: `Test: ${className}.${methodName}`,
        cwd: workspaceFolder.uri.fsPath
    });

    terminal.sendText(`${gradleCommand} test --tests "${className}.${methodName}"`);
    terminal.show();
}

function parseTestFileForDiscovery(content: string, uri: vscode.Uri): TestDiscoveryInfo | null {
    const fileName = path.basename(uri.fsPath, '.groovy');
    const methods: string[] = [];

    if (content.includes('extends Specification')) {
        // Spock tests
        const spockMethodRegex = /def\s+["']([^"']+)["']\s*\(\s*\)/g;
        let match;
        while ((match = spockMethodRegex.exec(content)) !== null) {
            methods.push(match[1]);
        }

        return {
            className: fileName,
            framework: 'Spock',
            methods,
            uri
        };
    } else if (content.includes('@Test')) {
        // JUnit tests
        const junitMethodRegex = /@Test[\s\S]*?def\s+(\w+)\s*\(/g;
        let match;
        while ((match = junitMethodRegex.exec(content)) !== null) {
            methods.push(match[1]);
        }

        return {
            className: fileName,
            framework: 'JUnit',
            methods,
            uri
        };
    }

    return null;
}

async function showTestDiscoveryResults(testInfo: TestDiscoveryInfo[]): Promise<void> {
    if (testInfo.length === 0) {
        vscode.window.showInformationMessage('No test files found');
        return;
    }

    const items: vscode.QuickPickItem[] = testInfo.map(info => ({
        label: info.className,
        detail: `${info.framework} - ${info.methods.length} test methods`,
        description: info.methods.slice(0, 3).join(', ') + (info.methods.length > 3 ? '...' : '')
    }));

    const selected = await vscode.window.showQuickPick(items, {
        title: `Test Discovery Results (${testInfo.length} test classes)`,
        placeHolder: 'Select a test class to open...'
    });

    if (selected) {
        const selectedInfo = testInfo.find(info => info.className === selected.label);
        if (selectedInfo) {
            const document = await vscode.workspace.openTextDocument(selectedInfo.uri);
            await vscode.window.showTextDocument(document);
        }
    }
}

function generateSpockTestTemplate(className: string): string {
    return `import spock.lang.Specification

class ${className}Spec extends Specification {

    def "should do something"() {
        given:
        // Setup test data

        when:
        // Execute the code under test

        then:
        // Verify the results
        true
    }

    def "should handle edge case"() {
        given:
        // Setup edge case scenario

        expect:
        // Verify expectations
        true
    }
}
`;
}

// Interfaces

interface TestDiscoveryInfo {
    className: string;
    framework: 'Spock' | 'JUnit';
    methods: string[];
    uri: vscode.Uri;
}