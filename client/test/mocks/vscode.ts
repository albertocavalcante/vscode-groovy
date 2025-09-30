/**
 * Mock implementation of VS Code APIs for unit testing
 */
import { stub } from 'sinon';

// Mock VS Code workspace API
export const workspace = {
    getConfiguration: stub().returns({
        get: stub(),
        has: stub(),
        inspect: stub(),
        update: stub()
    }),
    workspaceFolders: [] as any,
    onDidChangeConfiguration: stub(),
    createFileSystemWatcher: stub().returns({
        onDidCreate: stub(),
        onDidChange: stub(),
        onDidDelete: stub(),
        dispose: stub()
    }),
    findFiles: stub().resolves([]),
    fs: {
        readFile: stub(),
        writeFile: stub(),
        stat: stub(),
        readDirectory: stub()
    }
};

// Mock VS Code window API
export const window = {
    showInformationMessage: stub(),
    showWarningMessage: stub(),
    showErrorMessage: stub(),
    showQuickPick: stub(),
    showInputBox: stub(),
    createOutputChannel: stub().returns({
        appendLine: stub(),
        append: stub(),
        show: stub(),
        hide: stub(),
        dispose: stub()
    }),
    createTerminal: stub().returns({
        sendText: stub(),
        show: stub(),
        hide: stub(),
        dispose: stub()
    }),
    activeTextEditor: undefined,
    showTextDocument: stub(),
    withProgress: stub()
};

// Mock VS Code commands API
export const commands = {
    registerCommand: stub(),
    executeCommand: stub(),
    getCommands: stub().resolves([])
};

// Mock VS Code tasks API
export const tasks = {
    registerTaskProvider: stub(),
    executeTask: stub()
};

// Mock VS Code tests API
export const tests = {
    createTestController: stub().returns({
        items: new Map(),
        createTestItem: stub(),
        createRunProfile: stub(),
        dispose: stub()
    })
};

// Mock VS Code enums and classes
export const TaskScope = {
    Global: 1,
    Workspace: 2
};

export const TaskGroup = {
    Build: { _id: 'build' },
    Test: { _id: 'test' },
    Clean: { _id: 'clean' }
};

export const ConfigurationTarget = {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3
};

export const Uri = {
    parse: stub().returns({ fsPath: '/mock/path', toString: () => 'file:///mock/path' }),
    file: stub().returns({ fsPath: '/mock/path', toString: () => 'file:///mock/path' }),
    joinPath: stub().returns({ fsPath: '/mock/path', toString: () => 'file:///mock/path' })
};

export const Range = class {
    constructor(public start: any, public end: any) {}
};

export const Position = class {
    constructor(public line: number, public character: number) {}
};

export const Selection = class {
    constructor(public start: any, public end: any) {
        this.active = end;
        this.anchor = start;
        this.isEmpty = start === end;
    }
    active: any;
    anchor: any;
    isEmpty: boolean;
};

export const RelativePattern = class {
    constructor(public base: any, public pattern: string) {}
};

export const TestRunProfileKind = {
    Run: 1,
    Debug: 2,
    Coverage: 3
};

export const ProgressLocation = {
    SourceControl: 1,
    Window: 10,
    Notification: 15
};

// Reset function for tests
export function resetMocks() {
    Object.values(workspace).forEach(mock => {
        if (typeof mock === 'function' && mock.reset) {
            mock.reset();
        }
    });
    Object.values(window).forEach(mock => {
        if (typeof mock === 'function' && mock.reset) {
            mock.reset();
        }
    });
    Object.values(commands).forEach(mock => {
        if (typeof mock === 'function' && mock.reset) {
            mock.reset();
        }
    });
}