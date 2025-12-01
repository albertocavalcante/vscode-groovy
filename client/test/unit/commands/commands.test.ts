import { expect } from 'chai';
import * as sinon from 'sinon';
import proxyquire = require('proxyquire');

// Create vscode mocks
const registerCommandStub = sinon.stub();
const showInformationMessageStub = sinon.stub();
const showErrorMessageStub = sinon.stub();

const vscode = {
    commands: {
        registerCommand: registerCommandStub,
        executeCommand: sinon.stub()
    },
    window: {
        showInformationMessage: showInformationMessageStub,
        showErrorMessage: showErrorMessageStub
    }
};

// Mock UpdateCheckerService
class MockUpdateCheckerService {
    checkForUpdates = sinon.stub();
    getVersionInfo = sinon.stub();
    initialize = sinon.stub();
    dispose = sinon.stub();
}

// Mock server/client module
const clientModule = {
    restartClient: sinon.stub(),
    getClient: sinon.stub()
};

// Mock ExecuteCommandRequest
const ExecuteCommandRequest = {
    type: { method: 'workspace/executeCommand' }
};

// Load commands module with mocked dependencies
const { registerCommands, setUpdateCheckerService } = proxyquire.noCallThru()('../../../src/commands/index', {
    'vscode': vscode,
    '../server/client': clientModule,
    'vscode-languageclient': {
        ExecuteCommandRequest
    },
    '../features/update': {
        UpdateCheckerService: MockUpdateCheckerService
    }
});

describe('Commands - Integration Tests', () => {
    let mockContext: any;
    let mockUpdateCheckerService: MockUpdateCheckerService;

    beforeEach(() => {
        // Create mock extension context
        mockContext = {
            subscriptions: []
        };

        // Create mock update checker service
        mockUpdateCheckerService = new MockUpdateCheckerService();

        // Reset the update checker service to null before each test
        setUpdateCheckerService(null as any);

        // Reset stubs
        registerCommandStub.reset();
        showInformationMessageStub.reset();
        showErrorMessageStub.reset();
        mockUpdateCheckerService.checkForUpdates.reset();
        mockUpdateCheckerService.getVersionInfo.reset();
        mockUpdateCheckerService.initialize.reset();
        mockUpdateCheckerService.dispose.reset();

        // Setup default stub behaviors
        registerCommandStub.callsFake((command: string, handler: Function) => {
            return { dispose: () => {} };
        });
    });

    describe('groovy.showVersion command', () => {
        it('should register the show version command', () => {
            registerCommands(mockContext);

            const showVersionCommand = registerCommandStub.getCalls().find(
                call => call.args[0] === 'groovy.showVersion'
            );

            expect(showVersionCommand).to.not.be.undefined;
        });

        it('should display installed version only when latest is unknown', async () => {
            let commandHandler: Function | undefined;

            registerCommandStub.callsFake((command: string, handler: Function) => {
                if (command === 'groovy.showVersion') {
                    commandHandler = handler;
                }
                return { dispose: () => {} };
            });

            setUpdateCheckerService(mockUpdateCheckerService as any);
            registerCommands(mockContext);

            mockUpdateCheckerService.getVersionInfo.resolves({
                installedVersion: '0.2.0',
                latestVersion: null,
                isUpdateAvailable: false
            });

            await commandHandler!();

            expect(mockUpdateCheckerService.getVersionInfo.calledOnce).to.be.true;
            expect(showInformationMessageStub.calledOnce).to.be.true;
            expect(showInformationMessageStub.firstCall.args[0]).to.equal('Installed: 0.2.0');
        });

        it('should display both installed and latest version when both are known', async () => {
            let commandHandler: Function | undefined;

            registerCommandStub.callsFake((command: string, handler: Function) => {
                if (command === 'groovy.showVersion') {
                    commandHandler = handler;
                }
                return { dispose: () => {} };
            });

            setUpdateCheckerService(mockUpdateCheckerService as any);
            registerCommands(mockContext);

            mockUpdateCheckerService.getVersionInfo.resolves({
                installedVersion: '0.2.0',
                latestVersion: '0.2.0',
                isUpdateAvailable: false
            });

            await commandHandler!();

            expect(showInformationMessageStub.calledOnce).to.be.true;
            expect(showInformationMessageStub.firstCall.args[0]).to.include('Installed: 0.2.0');
            expect(showInformationMessageStub.firstCall.args[0]).to.include('Latest: 0.2.0');
        });

        it('should indicate when update is available', async () => {
            let commandHandler: Function | undefined;

            registerCommandStub.callsFake((command: string, handler: Function) => {
                if (command === 'groovy.showVersion') {
                    commandHandler = handler;
                }
                return { dispose: () => {} };
            });

            setUpdateCheckerService(mockUpdateCheckerService as any);
            registerCommands(mockContext);

            mockUpdateCheckerService.getVersionInfo.resolves({
                installedVersion: '0.2.0',
                latestVersion: '0.3.0',
                isUpdateAvailable: true
            });

            await commandHandler!();

            expect(showInformationMessageStub.calledOnce).to.be.true;
            expect(showInformationMessageStub.firstCall.args[0]).to.include('Installed: 0.2.0');
            expect(showInformationMessageStub.firstCall.args[0]).to.include('Latest: 0.3.0');
            expect(showInformationMessageStub.firstCall.args[0]).to.include('(update available)');
        });

        it('should handle unknown installed version', async () => {
            let commandHandler: Function | undefined;

            registerCommandStub.callsFake((command: string, handler: Function) => {
                if (command === 'groovy.showVersion') {
                    commandHandler = handler;
                }
                return { dispose: () => {} };
            });

            setUpdateCheckerService(mockUpdateCheckerService as any);
            registerCommands(mockContext);

            mockUpdateCheckerService.getVersionInfo.resolves({
                installedVersion: null,
                latestVersion: '0.3.0',
                isUpdateAvailable: false
            });

            await commandHandler!();

            expect(showInformationMessageStub.calledOnce).to.be.true;
            expect(showInformationMessageStub.firstCall.args[0]).to.include('Installed: Unknown');
            expect(showInformationMessageStub.firstCall.args[0]).to.include('Latest: 0.3.0');
        });

        it('should show error message when update checker service is not initialized', async () => {
            let commandHandler: Function | undefined;

            registerCommandStub.callsFake((command: string, handler: Function) => {
                if (command === 'groovy.showVersion') {
                    commandHandler = handler;
                }
                return { dispose: () => {} };
            });

            // Don't set the update checker service
            registerCommands(mockContext);

            await commandHandler!();

            expect(showErrorMessageStub.calledOnce).to.be.true;
            expect(showErrorMessageStub.firstCall.args[0]).to.include('not initialized');
        });

        it('should show error message when getVersionInfo throws an error', async () => {
            let commandHandler: Function | undefined;

            registerCommandStub.callsFake((command: string, handler: Function) => {
                if (command === 'groovy.showVersion') {
                    commandHandler = handler;
                }
                return { dispose: () => {} };
            });

            setUpdateCheckerService(mockUpdateCheckerService as any);
            registerCommands(mockContext);

            mockUpdateCheckerService.getVersionInfo.rejects(new Error('Service error'));

            await commandHandler!();

            expect(showErrorMessageStub.calledOnce).to.be.true;
            expect(showErrorMessageStub.firstCall.args[0]).to.include('Service error');
        });
    });

    describe('groovy.update.check command', () => {
        it('should register the update check command', () => {
            registerCommands(mockContext);

            const updateCheckCommand = registerCommandStub.getCalls().find(
                call => call.args[0] === 'groovy.update.check'
            );

            expect(updateCheckCommand).to.not.be.undefined;
        });

        it('should call checkForUpdates with force=true when command is executed', async () => {
            let commandHandler: Function | undefined;

            registerCommandStub.callsFake((command: string, handler: Function) => {
                if (command === 'groovy.update.check') {
                    commandHandler = handler;
                }
                return { dispose: () => {} };
            });

            setUpdateCheckerService(mockUpdateCheckerService as any);
            registerCommands(mockContext);

            expect(commandHandler).to.not.be.undefined;

            mockUpdateCheckerService.checkForUpdates.resolves({
                status: 'up-to-date',
                installedVersion: '0.2.0',
                latestVersion: '0.2.0',
                releaseUrl: null
            });

            await commandHandler!();

            expect(mockUpdateCheckerService.checkForUpdates.calledOnce).to.be.true;
            expect(mockUpdateCheckerService.checkForUpdates.calledWith(true)).to.be.true;
        });

        it('should show error message when update checker service is not initialized', async () => {
            let commandHandler: Function | undefined;

            registerCommandStub.callsFake((command: string, handler: Function) => {
                if (command === 'groovy.update.check') {
                    commandHandler = handler;
                }
                return { dispose: () => {} };
            });

            // Don't set the update checker service
            registerCommands(mockContext);

            await commandHandler!();

            expect(showErrorMessageStub.calledOnce).to.be.true;
            expect(showErrorMessageStub.firstCall.args[0]).to.include('not initialized');
        });

        it('should show error message when checkForUpdates throws an error', async () => {
            let commandHandler: Function | undefined;

            registerCommandStub.callsFake((command: string, handler: Function) => {
                if (command === 'groovy.update.check') {
                    commandHandler = handler;
                }
                return { dispose: () => {} };
            });

            setUpdateCheckerService(mockUpdateCheckerService as any);
            registerCommands(mockContext);

            mockUpdateCheckerService.checkForUpdates.rejects(new Error('Network error'));

            await commandHandler!();

            expect(showErrorMessageStub.calledOnce).to.be.true;
            expect(showErrorMessageStub.firstCall.args[0]).to.include('Network error');
        });

        it('should handle non-Error exceptions gracefully', async () => {
            let commandHandler: Function | undefined;

            registerCommandStub.callsFake((command: string, handler: Function) => {
                if (command === 'groovy.update.check') {
                    commandHandler = handler;
                }
                return { dispose: () => {} };
            });

            setUpdateCheckerService(mockUpdateCheckerService as any);
            registerCommands(mockContext);

            // Sinon wraps string rejections in Error objects, so we need to test differently
            // Create a non-Error object that will be caught
            mockUpdateCheckerService.checkForUpdates.callsFake(() => {
                return Promise.reject('String error');
            });

            await commandHandler!();

            expect(showErrorMessageStub.calledOnce).to.be.true;
            // The error message should contain "Failed to check for updates:"
            expect(showErrorMessageStub.firstCall.args[0]).to.include('Failed to check for updates:');
        });
    });

    describe('command registration', () => {
        it('should register all commands and add them to context subscriptions', () => {
            registerCommands(mockContext);

            // Should register at least 3 commands: restartServer, showVersion, update.check
            expect(registerCommandStub.callCount).to.be.at.least(3);

            // Should add disposables to context subscriptions
            expect(mockContext.subscriptions.length).to.be.at.least(3);
        });

        it('should return array of disposables', () => {
            const disposables = registerCommands(mockContext);

            expect(disposables).to.be.an('array');
            expect(disposables.length).to.be.at.least(3);
        });
    });
});
