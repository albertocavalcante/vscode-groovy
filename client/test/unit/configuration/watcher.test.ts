import { expect } from 'chai';
import * as sinon from 'sinon';
import proxyquire = require('proxyquire');

// Create vscode mocks
const onDidChangeConfigurationStub = sinon.stub();
const getConfigurationStub = sinon.stub();
const showInformationMessageStub = sinon.stub();
const createOutputChannelStub = sinon.stub();

const mockOutputChannel = {
    appendLine: sinon.stub(),
    append: sinon.stub(),
    clear: sinon.stub(),
    show: sinon.stub(),
    hide: sinon.stub(),
    dispose: sinon.stub()
};

createOutputChannelStub.returns(mockOutputChannel);

const vscode = {
    workspace: {
        onDidChangeConfiguration: onDidChangeConfigurationStub,
        getConfiguration: getConfigurationStub
    },
    window: {
        showInformationMessage: showInformationMessageStub,
        createOutputChannel: createOutputChannelStub
    }
};

// Mock UpdateCheckerService
class MockUpdateCheckerService {
    checkForUpdates = sinon.stub();
    initialize = sinon.stub();
    dispose = sinon.stub();
}

// Mock settings module
const settingsModule = {
    requiresServerRestart: sinon.stub(),
    canBeAppliedDynamically: sinon.stub(),
    affectsUpdateConfiguration: sinon.stub()
};

// Mock client module
const clientModule = {
    restartClient: sinon.stub(),
    getClient: sinon.stub()
};

// Load watcher module with mocked dependencies
const { setupConfigurationWatcher, setUpdateCheckerServiceRef, setOutputChannel } = proxyquire.noCallThru()('../../../src/configuration/watcher', {
    'vscode': vscode,
    './settings': settingsModule,
    '../server/client': clientModule,
    '../features/update': {
        UpdateCheckerService: MockUpdateCheckerService
    }
});

describe('Configuration Watcher - Integration Tests', () => {
    let mockUpdateCheckerService: MockUpdateCheckerService;
    let configChangeHandler: Function;

    beforeEach(() => {
        // Create mock update checker service
        mockUpdateCheckerService = new MockUpdateCheckerService();

        // Set output channel for logging
        setOutputChannel(mockOutputChannel as any);

        // Reset stubs
        onDidChangeConfigurationStub.reset();
        getConfigurationStub.reset();
        showInformationMessageStub.reset();
        mockOutputChannel.appendLine.reset();
        settingsModule.requiresServerRestart.reset();
        settingsModule.canBeAppliedDynamically.reset();
        settingsModule.affectsUpdateConfiguration.reset();
        clientModule.restartClient.reset();
        clientModule.getClient.reset();
        mockUpdateCheckerService.checkForUpdates.reset();

        // Setup default behaviors
        onDidChangeConfigurationStub.callsFake((handler: Function) => {
            configChangeHandler = handler;
            return { dispose: () => {} };
        });

        settingsModule.requiresServerRestart.returns(false);
        settingsModule.canBeAppliedDynamically.returns(false);
        settingsModule.affectsUpdateConfiguration.returns(false);
        clientModule.restartClient.resolves();
        clientModule.getClient.returns({});
        mockUpdateCheckerService.checkForUpdates.resolves({
            status: 'up-to-date',
            installedVersion: '0.2.0',
            latestVersion: '0.2.0',
            releaseUrl: null
        });
    });

    describe('airgap mode toggle handling', () => {
        it('should trigger update check when airgap mode is disabled', async () => {
            setUpdateCheckerServiceRef(mockUpdateCheckerService as any);
            setupConfigurationWatcher();

            // Mock configuration change event
            const mockEvent = {
                affectsConfiguration: sinon.stub().callsFake((section: string) => {
                    return section === 'groovy' || section === 'groovy.update.airgapMode';
                })
            };

            // Mock configuration to return airgapMode = false
            const mockConfig = {
                get: sinon.stub().callsFake((key: string, defaultValue?: any) => {
                    if (key === 'airgapMode') return false;
                    return defaultValue;
                })
            };
            getConfigurationStub.withArgs('groovy.update').returns(mockConfig);

            settingsModule.affectsUpdateConfiguration.returns(true);

            await configChangeHandler(mockEvent);

            expect(mockUpdateCheckerService.checkForUpdates.called).to.be.true;
        });

        it('should not trigger update check when airgap mode is enabled', async () => {
            setUpdateCheckerServiceRef(mockUpdateCheckerService as any);
            setupConfigurationWatcher();

            const mockEvent = {
                affectsConfiguration: sinon.stub().callsFake((section: string) => {
                    return section === 'groovy' || section === 'groovy.update.airgapMode';
                })
            };

            // Mock configuration to return airgapMode = true
            const mockConfig = {
                get: sinon.stub().callsFake((key: string, defaultValue?: any) => {
                    if (key === 'airgapMode') return true;
                    return defaultValue;
                })
            };
            getConfigurationStub.withArgs('groovy.update').returns(mockConfig);

            settingsModule.affectsUpdateConfiguration.returns(true);

            await configChangeHandler(mockEvent);

            expect(mockUpdateCheckerService.checkForUpdates.called).to.be.false;
        });

        it('should handle errors during update check gracefully', async () => {
            setUpdateCheckerServiceRef(mockUpdateCheckerService as any);
            setupConfigurationWatcher();

            const mockEvent = {
                affectsConfiguration: sinon.stub().callsFake((section: string) => {
                    return section === 'groovy' || section === 'groovy.update.airgapMode';
                })
            };

            const mockConfig = {
                get: sinon.stub().callsFake((key: string, defaultValue?: any) => {
                    if (key === 'airgapMode') return false;
                    return defaultValue;
                })
            };
            getConfigurationStub.withArgs('groovy.update').returns(mockConfig);

            settingsModule.affectsUpdateConfiguration.returns(true);
            mockUpdateCheckerService.checkForUpdates.rejects(new Error('Network error'));

            // Should not throw
            await configChangeHandler(mockEvent);
            // If we get here without throwing, the test passes
        });
    });

    describe('autoUpdate toggle handling', () => {
        it('should log when autoUpdate is enabled', async () => {
            setUpdateCheckerServiceRef(mockUpdateCheckerService as any);
            setupConfigurationWatcher();

            const mockEvent = {
                affectsConfiguration: sinon.stub().callsFake((section: string) => {
                    return section === 'groovy' || section === 'groovy.update.autoUpdate';
                })
            };

            const mockConfig = {
                get: sinon.stub().callsFake((key: string, defaultValue?: any) => {
                    if (key === 'autoUpdate') return true;
                    return defaultValue;
                })
            };
            getConfigurationStub.withArgs('groovy.update').returns(mockConfig);

            settingsModule.affectsUpdateConfiguration.returns(true);

            // Should not throw
            await configChangeHandler(mockEvent);
            // If we get here without throwing, the test passes
        });

        it('should log when autoUpdate is disabled', async () => {
            setUpdateCheckerServiceRef(mockUpdateCheckerService as any);
            setupConfigurationWatcher();

            const mockEvent = {
                affectsConfiguration: sinon.stub().callsFake((section: string) => {
                    return section === 'groovy' || section === 'groovy.update.autoUpdate';
                })
            };

            const mockConfig = {
                get: sinon.stub().callsFake((key: string, defaultValue?: any) => {
                    if (key === 'autoUpdate') return false;
                    return defaultValue;
                })
            };
            getConfigurationStub.withArgs('groovy.update').returns(mockConfig);

            settingsModule.affectsUpdateConfiguration.returns(true);

            // Should not throw
            await configChangeHandler(mockEvent);
            // If we get here without throwing, the test passes
        });
    });

    describe('checkInterval change handling', () => {
        it('should handle checkInterval changes', async () => {
            setUpdateCheckerServiceRef(mockUpdateCheckerService as any);
            setupConfigurationWatcher();

            const mockEvent = {
                affectsConfiguration: sinon.stub().callsFake((section: string) => {
                    return section === 'groovy' || section === 'groovy.update.checkInterval';
                })
            };

            settingsModule.affectsUpdateConfiguration.returns(true);

            // Should not throw
            await configChangeHandler(mockEvent);
            // If we get here without throwing, the test passes
        });
    });

    describe('update configuration handling without service', () => {
        it('should handle update configuration changes gracefully when service is not set', async () => {
            // Don't set the update checker service
            setupConfigurationWatcher();

            const mockEvent = {
                affectsConfiguration: sinon.stub().callsFake((section: string) => {
                    return section === 'groovy' || section === 'groovy.update.airgapMode';
                })
            };

            // Mock configuration even though service is not set
            const mockConfig = {
                get: sinon.stub().callsFake((key: string, defaultValue?: any) => {
                    if (key === 'airgapMode') return false;
                    return defaultValue;
                })
            };
            getConfigurationStub.withArgs('groovy.update').returns(mockConfig);

            settingsModule.affectsUpdateConfiguration.returns(true);

            // Should not throw even without service
            await configChangeHandler(mockEvent);
            // If we get here without throwing, the test passes
        });
    });

    describe('non-update configuration changes', () => {
        it('should not handle update configuration when event does not affect update settings', async () => {
            setUpdateCheckerServiceRef(mockUpdateCheckerService as any);
            setupConfigurationWatcher();

            const mockEvent = {
                affectsConfiguration: sinon.stub().callsFake((section: string) => {
                    return section === 'groovy';
                })
            };

            settingsModule.affectsUpdateConfiguration.returns(false);
            settingsModule.requiresServerRestart.returns(false);
            settingsModule.canBeAppliedDynamically.returns(false);

            await configChangeHandler(mockEvent);

            expect(mockUpdateCheckerService.checkForUpdates.called).to.be.false;
        });

        it('should ignore non-groovy configuration changes', async () => {
            setUpdateCheckerServiceRef(mockUpdateCheckerService as any);
            setupConfigurationWatcher();

            const mockEvent = {
                affectsConfiguration: sinon.stub().returns(false)
            };

            await configChangeHandler(mockEvent);

            expect(mockUpdateCheckerService.checkForUpdates.called).to.be.false;
        });
    });

    describe('watcher disposal', () => {
        it('should return a disposable', () => {
            const disposable = setupConfigurationWatcher();

            expect(disposable).to.have.property('dispose');
            expect(disposable.dispose).to.be.a('function');
        });
    });
});
