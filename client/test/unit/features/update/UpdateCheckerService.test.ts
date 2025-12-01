import { expect } from 'chai';
import * as sinon from 'sinon';
import proxyquire = require('proxyquire');

// Create vscode mocks
const showInformationMessageStub = sinon.stub();
const showErrorMessageStub = sinon.stub();
const openExternalStub = sinon.stub();
const executeCommandStub = sinon.stub();
const getConfigurationStub = sinon.stub();

const vscode = {
    window: {
        showInformationMessage: showInformationMessageStub,
        showErrorMessage: showErrorMessageStub
    },
    env: {
        openExternal: openExternalStub
    },
    commands: {
        executeCommand: executeCommandStub
    },
    workspace: {
        getConfiguration: getConfigurationStub
    },
    Uri: {
        parse: sinon.stub().callsFake((url: string) => ({ toString: () => url }))
    },
    ConfigurationTarget: {
        Global: 1
    }
};

// Load modules with mocked vscode
const versionCheckerModule = proxyquire.noCallThru()('../../../../src/features/update/VersionChecker', {
    'vscode': vscode
});

const versionCacheModule = proxyquire.noCallThru()('../../../../src/features/update/VersionCache', {
    'vscode': vscode
});

const updateNotifierModule = proxyquire.noCallThru()('../../../../src/features/update/UpdateNotifier', {
    'vscode': vscode
});

const updateInstallerModule = proxyquire.noCallThru()('../../../../src/features/update/UpdateInstaller', {
    'vscode': vscode
});

const settingsModule = proxyquire.noCallThru()('../../../../src/configuration/settings', {
    'vscode': vscode
});

const { UpdateCheckerService } = proxyquire.noCallThru()('../../../../src/features/update/UpdateCheckerService', {
    'vscode': vscode,
    './VersionChecker': versionCheckerModule,
    './VersionCache': versionCacheModule,
    './UpdateNotifier': updateNotifierModule,
    './UpdateInstaller': updateInstallerModule,
    '../../configuration/settings': settingsModule
});

import type { UpdateCheckerService as UpdateCheckerServiceType } from '../../../../src/features/update/UpdateCheckerService';

describe('UpdateCheckerService - Unit Tests', () => {
    let service: UpdateCheckerServiceType;
    let mockContext: any;
    let mockGlobalState: any;
    let getUpdateConfigStub: sinon.SinonStub;

    beforeEach(() => {
        // Create mock global state
        const stateMap = new Map<string, any>();
        mockGlobalState = {
            get: sinon.stub().callsFake((key: string) => stateMap.get(key)),
            update: sinon.stub().callsFake((key: string, value: any) => {
                stateMap.set(key, value);
                return Promise.resolve();
            }),
            keys: sinon.stub().returns([])
        };

        // Create mock extension context
        mockContext = {
            extensionPath: '/test/extension',
            globalState: mockGlobalState,
            subscriptions: []
        };

        // Stub getUpdateConfiguration
        getUpdateConfigStub = sinon.stub(settingsModule, 'getUpdateConfiguration');

        // Reset vscode stubs
        showInformationMessageStub.reset();
        showErrorMessageStub.reset();
        openExternalStub.reset();
        executeCommandStub.reset();
        getConfigurationStub.reset();

        service = new UpdateCheckerService();
    });

    afterEach(() => {
        service.dispose();
        getUpdateConfigStub.restore();
    });

    describe('initialization and disposal', () => {
        it('should initialize successfully with valid context', () => {
            getUpdateConfigStub.returns({
                airgapMode: false,
                autoUpdate: false,
                checkOnStartup: false,
                checkInterval: 24
            });

            expect(() => service.initialize(mockContext)).to.not.throw();
        });

        it('should throw error when initializing after disposal', () => {
            service.dispose();

            expect(() => service.initialize(mockContext)).to.throw('UpdateCheckerService has been disposed');
        });

        it('should be safe to call dispose multiple times', () => {
            service.dispose();
            expect(() => service.dispose()).to.not.throw();
        });
    });

    describe('airgap mode blocking', () => {
        it('should return skipped status when airgap mode is enabled', async () => {
            getUpdateConfigStub.returns({
                airgapMode: true,
                autoUpdate: false,
                checkOnStartup: false,
                checkInterval: 24
            });

            service.initialize(mockContext);
            const result = await service.checkForUpdates();

            expect(result.status).to.equal('skipped');
        });

        it('should not make network requests when airgap mode is enabled', async () => {
            getUpdateConfigStub.returns({
                airgapMode: true,
                autoUpdate: false,
                checkOnStartup: false,
                checkInterval: 24
            });

            const versionChecker = (service as any).versionChecker;
            const getLatestReleaseSpy = sinon.spy(versionChecker, 'getLatestRelease');

            service.initialize(mockContext);
            await service.checkForUpdates();

            expect(getLatestReleaseSpy.called).to.be.false;
        });

        it('should bypass airgap mode when force=true', async () => {
            getUpdateConfigStub.returns({
                airgapMode: true,
                autoUpdate: false,
                checkOnStartup: false,
                checkInterval: 24
            });

            service.initialize(mockContext);

            // Mock the version checker to return a release
            const versionChecker = (service as any).versionChecker;
            sinon.stub(versionChecker, 'getLatestRelease').resolves({
                tagName: 'v0.2.0',
                version: '0.2.0',
                releaseUrl: 'https://github.com/test/release',
                downloadUrl: 'https://github.com/test/download.jar',
                checksum: 'abc123',
                publishedAt: new Date().toISOString()
            });
            sinon.stub(versionChecker, 'isValidVersion').returns(true);
            sinon.stub(versionChecker, 'compareVersions').returns(0);

            // Mock installer to return a version
            const updateInstaller = (service as any).updateInstaller;
            sinon.stub(updateInstaller, 'getInstalledVersion').returns('0.2.0');

            const result = await service.checkForUpdates(true);

            // Should not be skipped when forced
            expect(result.status).to.not.equal('skipped');
        });
    });

    describe('auto-update triggering', () => {
        it('should automatically install when autoUpdate is enabled and update is available', async () => {
            getUpdateConfigStub.returns({
                airgapMode: false,
                autoUpdate: true,
                checkOnStartup: false,
                checkInterval: 24
            });

            service.initialize(mockContext);

            // Mock version checker
            const versionChecker = (service as any).versionChecker;
            sinon.stub(versionChecker, 'isValidVersion').returns(true);
            sinon.stub(versionChecker, 'compareVersions').returns(1); // latest > installed
            sinon.stub(versionChecker, 'getLatestRelease').resolves({
                tagName: 'v0.2.0',
                version: '0.2.0',
                releaseUrl: 'https://github.com/test/release',
                downloadUrl: 'https://github.com/test/download.jar',
                checksum: 'abc123',
                publishedAt: new Date().toISOString()
            });

            // Mock installer
            const updateInstaller = (service as any).updateInstaller;
            sinon.stub(updateInstaller, 'getInstalledVersion').returns('0.1.0');
            const installReleaseSpy = sinon.stub(updateInstaller, 'installRelease').resolves({
                success: true,
                version: '0.2.0'
            });

            // Mock notifier
            showInformationMessageStub.resolves(undefined);

            await service.checkForUpdates();

            expect(installReleaseSpy.called).to.be.true;
        });

        it('should not automatically install when autoUpdate is disabled', async () => {
            getUpdateConfigStub.returns({
                airgapMode: false,
                autoUpdate: false,
                checkOnStartup: false,
                checkInterval: 24
            });

            service.initialize(mockContext);

            // Mock version checker
            const versionChecker = (service as any).versionChecker;
            sinon.stub(versionChecker, 'isValidVersion').returns(true);
            sinon.stub(versionChecker, 'compareVersions').returns(1);
            sinon.stub(versionChecker, 'getLatestRelease').resolves({
                tagName: 'v0.2.0',
                version: '0.2.0',
                releaseUrl: 'https://github.com/test/release',
                downloadUrl: 'https://github.com/test/download.jar',
                checksum: 'abc123',
                publishedAt: new Date().toISOString()
            });

            // Mock installer
            const updateInstaller = (service as any).updateInstaller;
            sinon.stub(updateInstaller, 'getInstalledVersion').returns('0.1.0');
            const installReleaseSpy = sinon.stub(updateInstaller, 'installRelease').resolves({
                success: true,
                version: '0.2.0'
            });

            // Mock notifier to dismiss
            showInformationMessageStub.resolves(undefined);

            await service.checkForUpdates();

            expect(installReleaseSpy.called).to.be.false;
        });
    });

    describe('cache usage', () => {
        it('should use cached release when available and not expired', async () => {
            getUpdateConfigStub.returns({
                airgapMode: false,
                autoUpdate: false,
                checkOnStartup: false,
                checkInterval: 24
            });

            service.initialize(mockContext);

            // Pre-populate cache
            const versionCache = (service as any).versionCache;
            await versionCache.setCachedRelease({
                tagName: 'v0.2.0',
                version: '0.2.0',
                releaseUrl: 'https://github.com/test/release',
                downloadUrl: 'https://github.com/test/download.jar',
                checksum: 'abc123',
                publishedAt: new Date().toISOString()
            });

            // Mock version checker
            const versionChecker = (service as any).versionChecker;
            const getLatestReleaseSpy = sinon.spy(versionChecker, 'getLatestRelease');
            sinon.stub(versionChecker, 'isValidVersion').returns(true);
            sinon.stub(versionChecker, 'compareVersions').returns(0);

            // Mock installer
            const updateInstaller = (service as any).updateInstaller;
            sinon.stub(updateInstaller, 'getInstalledVersion').returns('0.2.0');

            await service.checkForUpdates();

            // Should not fetch from GitHub since cache is valid
            expect(getLatestReleaseSpy.called).to.be.false;
        });

        it('should bypass cache when force=true', async () => {
            getUpdateConfigStub.returns({
                airgapMode: false,
                autoUpdate: false,
                checkOnStartup: false,
                checkInterval: 24
            });

            service.initialize(mockContext);

            // Pre-populate cache
            const versionCache = (service as any).versionCache;
            await versionCache.setCachedRelease({
                tagName: 'v0.2.0',
                version: '0.2.0',
                releaseUrl: 'https://github.com/test/release',
                downloadUrl: 'https://github.com/test/download.jar',
                checksum: 'abc123',
                publishedAt: new Date().toISOString()
            });

            // Mock version checker
            const versionChecker = (service as any).versionChecker;
            const getLatestReleaseSpy = sinon.stub(versionChecker, 'getLatestRelease').resolves({
                tagName: 'v0.3.0',
                version: '0.3.0',
                releaseUrl: 'https://github.com/test/release',
                downloadUrl: 'https://github.com/test/download.jar',
                checksum: 'def456',
                publishedAt: new Date().toISOString()
            });
            sinon.stub(versionChecker, 'isValidVersion').returns(true);
            sinon.stub(versionChecker, 'compareVersions').returns(0);

            // Mock installer
            const updateInstaller = (service as any).updateInstaller;
            sinon.stub(updateInstaller, 'getInstalledVersion').returns('0.3.0');

            await service.checkForUpdates(true);

            // Should fetch from GitHub even though cache is valid
            expect(getLatestReleaseSpy.called).to.be.true;
        });
    });

    describe('error handling', () => {
        it('should return error status when service is not initialized', async () => {
            const result = await service.checkForUpdates();

            expect(result.status).to.equal('error');
            expect(result.error).to.include('not initialized');
        });

        it('should return error status when service is disposed', async () => {
            service.dispose();

            const result = await service.checkForUpdates();

            expect(result.status).to.equal('error');
            expect(result.error).to.include('disposed');
        });

        it('should return skipped status for invalid installed version', async () => {
            getUpdateConfigStub.returns({
                airgapMode: false,
                autoUpdate: false,
                checkOnStartup: false,
                checkInterval: 24
            });

            service.initialize(mockContext);

            // Mock installer to return invalid version
            const updateInstaller = (service as any).updateInstaller;
            sinon.stub(updateInstaller, 'getInstalledVersion').returns('local');

            // Mock version checker
            const versionChecker = (service as any).versionChecker;
            sinon.stub(versionChecker, 'isValidVersion').returns(false);

            const result = await service.checkForUpdates();

            expect(result.status).to.equal('skipped');
        });

        it('should return error status when GitHub API fails', async () => {
            getUpdateConfigStub.returns({
                airgapMode: false,
                autoUpdate: false,
                checkOnStartup: false,
                checkInterval: 24
            });

            service.initialize(mockContext);

            // Mock version checker to fail
            const versionChecker = (service as any).versionChecker;
            sinon.stub(versionChecker, 'isValidVersion').returns(true);
            sinon.stub(versionChecker, 'getLatestRelease').resolves(null);

            // Mock installer
            const updateInstaller = (service as any).updateInstaller;
            sinon.stub(updateInstaller, 'getInstalledVersion').returns('0.1.0');

            const result = await service.checkForUpdates();

            expect(result.status).to.equal('error');
            expect(result.error).to.include('Failed to fetch');
        });
    });

    describe('getVersionInfo', () => {
        it('should return installed and latest version when both are available', async () => {
            getUpdateConfigStub.returns({
                airgapMode: false,
                autoUpdate: false,
                checkOnStartup: false,
                checkInterval: 24
            });

            service.initialize(mockContext);

            // Mock installer to return installed version
            const updateInstaller = (service as any).updateInstaller;
            sinon.stub(updateInstaller, 'getInstalledVersion').returns('0.2.0');

            // Mock cache to return latest version
            const versionCache = (service as any).versionCache;
            sinon.stub(versionCache, 'getCachedRelease').returns({
                release: {
                    tagName: 'v0.3.0',
                    version: '0.3.0',
                    releaseUrl: 'https://github.com/test/releases/tag/v0.3.0',
                    downloadUrl: 'https://github.com/test/download/v0.3.0',
                    checksum: 'abc123',
                    publishedAt: '2024-01-01T00:00:00Z'
                },
                checkedAt: Date.now(),
                expiresAt: Date.now() + 86400000
            });

            // Mock version checker
            const versionChecker = (service as any).versionChecker;
            sinon.stub(versionChecker, 'isValidVersion').returns(true);
            sinon.stub(versionChecker, 'compareVersions').returns(1); // 0.3.0 > 0.2.0

            const versionInfo = await service.getVersionInfo();

            expect(versionInfo.installedVersion).to.equal('0.2.0');
            expect(versionInfo.latestVersion).to.equal('0.3.0');
            expect(versionInfo.isUpdateAvailable).to.be.true;
        });

        it('should return only installed version when cache is empty', async () => {
            getUpdateConfigStub.returns({
                airgapMode: false,
                autoUpdate: false,
                checkOnStartup: false,
                checkInterval: 24
            });

            service.initialize(mockContext);

            // Mock installer to return installed version
            const updateInstaller = (service as any).updateInstaller;
            sinon.stub(updateInstaller, 'getInstalledVersion').returns('0.2.0');

            // Mock cache to return null
            const versionCache = (service as any).versionCache;
            sinon.stub(versionCache, 'getCachedRelease').returns(null);

            const versionInfo = await service.getVersionInfo();

            expect(versionInfo.installedVersion).to.equal('0.2.0');
            expect(versionInfo.latestVersion).to.be.null;
            expect(versionInfo.isUpdateAvailable).to.be.false;
        });

        it('should return null versions when service is not initialized', async () => {
            const versionInfo = await service.getVersionInfo();

            expect(versionInfo.installedVersion).to.be.null;
            expect(versionInfo.latestVersion).to.be.null;
            expect(versionInfo.isUpdateAvailable).to.be.false;
        });

        it('should indicate no update available when versions are equal', async () => {
            getUpdateConfigStub.returns({
                airgapMode: false,
                autoUpdate: false,
                checkOnStartup: false,
                checkInterval: 24
            });

            service.initialize(mockContext);

            // Mock installer to return installed version
            const updateInstaller = (service as any).updateInstaller;
            sinon.stub(updateInstaller, 'getInstalledVersion').returns('0.2.0');

            // Mock cache to return same version
            const versionCache = (service as any).versionCache;
            sinon.stub(versionCache, 'getCachedRelease').returns({
                release: {
                    tagName: 'v0.2.0',
                    version: '0.2.0',
                    releaseUrl: 'https://github.com/test/releases/tag/v0.2.0',
                    downloadUrl: 'https://github.com/test/download/v0.2.0',
                    checksum: 'abc123',
                    publishedAt: '2024-01-01T00:00:00Z'
                },
                checkedAt: Date.now(),
                expiresAt: Date.now() + 86400000
            });

            // Mock version checker
            const versionChecker = (service as any).versionChecker;
            sinon.stub(versionChecker, 'isValidVersion').returns(true);
            sinon.stub(versionChecker, 'compareVersions').returns(0); // 0.2.0 == 0.2.0

            const versionInfo = await service.getVersionInfo();

            expect(versionInfo.installedVersion).to.equal('0.2.0');
            expect(versionInfo.latestVersion).to.equal('0.2.0');
            expect(versionInfo.isUpdateAvailable).to.be.false;
        });

        it('should handle invalid installed version', async () => {
            getUpdateConfigStub.returns({
                airgapMode: false,
                autoUpdate: false,
                checkOnStartup: false,
                checkInterval: 24
            });

            service.initialize(mockContext);

            // Mock installer to return invalid version
            const updateInstaller = (service as any).updateInstaller;
            sinon.stub(updateInstaller, 'getInstalledVersion').returns('local');

            // Mock cache to return latest version
            const versionCache = (service as any).versionCache;
            sinon.stub(versionCache, 'getCachedRelease').returns({
                release: {
                    tagName: 'v0.3.0',
                    version: '0.3.0',
                    releaseUrl: 'https://github.com/test/releases/tag/v0.3.0',
                    downloadUrl: 'https://github.com/test/download/v0.3.0',
                    checksum: 'abc123',
                    publishedAt: '2024-01-01T00:00:00Z'
                },
                checkedAt: Date.now(),
                expiresAt: Date.now() + 86400000
            });

            // Mock version checker
            const versionChecker = (service as any).versionChecker;
            sinon.stub(versionChecker, 'isValidVersion').returns(false);

            const versionInfo = await service.getVersionInfo();

            expect(versionInfo.installedVersion).to.equal('local');
            expect(versionInfo.latestVersion).to.equal('0.3.0');
            expect(versionInfo.isUpdateAvailable).to.be.false;
        });
    });
});
