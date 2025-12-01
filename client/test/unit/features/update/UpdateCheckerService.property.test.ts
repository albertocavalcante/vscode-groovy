import { expect } from 'chai';
import * as fc from 'fast-check';
import * as sinon from 'sinon';
import proxyquire = require('proxyquire');
import { vscode } from '../../mocks/vscode';

// Import types for static analysis
import type { UpdateCheckerService as UpdateCheckerServiceType } from '../../../../src/features/update/UpdateCheckerService';
import type { VersionChecker as VersionCheckerType } from '../../../../src/features/update/VersionChecker';
import type { VersionCache as VersionCacheType } from '../../../../src/features/update/VersionCache';
import type { UpdateNotifier as UpdateNotifierType } from '../../../../src/features/update/UpdateNotifier';
import type { UpdateInstaller as UpdateInstallerType } from '../../../../src/features/update/UpdateInstaller';

// Load modules with mocked vscode - need to load dependencies first
const versionCheckerModule = proxyquire.noCallThru()('../../../../src/features/update/VersionChecker', {
    'vscode': vscode
});
const { VersionChecker } = versionCheckerModule as { VersionChecker: typeof VersionCheckerType };

const versionCacheModule = proxyquire.noCallThru()('../../../../src/features/update/VersionCache', {
    'vscode': vscode
});
const { VersionCache } = versionCacheModule as { VersionCache: typeof VersionCacheType };

const updateNotifierModule = proxyquire.noCallThru()('../../../../src/features/update/UpdateNotifier', {
    'vscode': vscode
});
const { UpdateNotifier } = updateNotifierModule as { UpdateNotifier: typeof UpdateNotifierType };

const updateInstallerModule = proxyquire.noCallThru()('../../../../src/features/update/UpdateInstaller', {
    'vscode': vscode
});
const { UpdateInstaller } = updateInstallerModule as { UpdateInstaller: typeof UpdateInstallerType };

// Load settings module with mocked vscode
const settingsModule = proxyquire.noCallThru()('../../../../src/configuration/settings', {
    'vscode': vscode
});

// Now load UpdateCheckerService with all dependencies mocked
const { UpdateCheckerService } = proxyquire.noCallThru()('../../../../src/features/update/UpdateCheckerService', {
    'vscode': vscode,
    './VersionChecker': versionCheckerModule,
    './VersionCache': versionCacheModule,
    './UpdateNotifier': updateNotifierModule,
    './UpdateInstaller': updateInstallerModule,
    '../../configuration/settings': settingsModule
}) as { UpdateCheckerService: typeof UpdateCheckerServiceType };

describe('UpdateCheckerService - Property-Based Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let service: UpdateCheckerServiceType;
    let mockContext: any;
    let mockGlobalState: any;
    let getUpdateConfigStub: sinon.SinonStub;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // Create mock global state
        const stateMap = new Map<string, any>();
        mockGlobalState = {
            get: sandbox.stub().callsFake((key: string) => stateMap.get(key)),
            update: sandbox.stub().callsFake((key: string, value: any) => {
                stateMap.set(key, value);
                return Promise.resolve();
            }),
            keys: sandbox.stub().returns([])
        };

        // Create mock extension context
        mockContext = {
            extensionPath: '/test/extension',
            globalState: mockGlobalState,
            subscriptions: []
        };

        // Stub getUpdateConfiguration
        getUpdateConfigStub = sandbox.stub();
        
        // Replace the import with our stub
        sandbox.stub(settingsModule, 'getUpdateConfiguration').callsFake(getUpdateConfigStub);

        // Reset vscode stubs
        (vscode.window.showInformationMessage as sinon.SinonStub).reset();
        (vscode.window.showErrorMessage as sinon.SinonStub).reset();
        (vscode.commands.executeCommand as sinon.SinonStub).reset();
        (vscode.workspace.getConfiguration as sinon.SinonStub).reset();

        service = new UpdateCheckerService();
    });

    afterEach(() => {
        service.dispose();
        sandbox.restore();
    });

    /**
     * Feature: lsp-update-checker, Property 3: Airgap mode prevents all update network activity
     * Validates: Requirements 4.1, 4.2
     */
    describe('Property 3: Airgap mode prevents all update network activity', () => {
        // Generator for various configuration states with airgap enabled
        const airgapConfigArbitrary = fc.record({
            airgapMode: fc.constant(true),
            autoUpdate: fc.boolean(),
            checkOnStartup: fc.boolean(),
            checkInterval: fc.integer({ min: 1, max: 168 }) // 1 hour to 1 week
        });

        it('should never make network requests when airgap mode is enabled', async () => {
            await fc.assert(
                fc.asyncProperty(airgapConfigArbitrary, async (config) => {
                    // Setup: Configure airgap mode
                    getUpdateConfigStub.returns(config);

                    // Create spy on VersionChecker to detect network calls
                    const versionChecker = new VersionChecker();
                    const getLatestReleaseSpy = sandbox.spy(versionChecker, 'getLatestRelease');

                    // Inject the spied version checker
                    (service as any).versionChecker = versionChecker;

                    // Initialize service
                    service.initialize(mockContext);

                    // Perform update check
                    const result = await service.checkForUpdates();

                    // Verify: No network calls were made
                    expect(getLatestReleaseSpy.called).to.be.false;
                    
                    // Verify: Result indicates skipped
                    expect(result.status).to.equal('skipped');
                }),
                { numRuns: 100 }
            );
        });

        it('should return skipped status for any installed version when airgap is enabled', async () => {
            await fc.assert(
                fc.asyncProperty(
                    airgapConfigArbitrary,
                    fc.oneof(
                        fc.constant('v0.1.0'),
                        fc.constant('v0.2.0'),
                        fc.constant('1.0.0'),
                        fc.constant('local'),
                        fc.constant(null)
                    ),
                    async (config, installedVersion) => {
                        // Setup
                        getUpdateConfigStub.returns(config);

                        const updateInstaller = new UpdateInstaller(mockContext.extensionPath);
                        sandbox.stub(updateInstaller, 'getInstalledVersion').returns(installedVersion);
                        (service as any).updateInstaller = updateInstaller;

                        const versionChecker = new VersionChecker();
                        const getLatestReleaseSpy = sandbox.spy(versionChecker, 'getLatestRelease');
                        (service as any).versionChecker = versionChecker;

                        service.initialize(mockContext);

                        // Execute
                        const result = await service.checkForUpdates();

                        // Verify: No network activity
                        expect(getLatestReleaseSpy.called).to.be.false;
                        expect(result.status).to.equal('skipped');
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should not display notifications when airgap mode is enabled', async () => {
            await fc.assert(
                fc.asyncProperty(airgapConfigArbitrary, async (config) => {
                    // Setup
                    getUpdateConfigStub.returns(config);

                    const updateNotifier = new UpdateNotifier();
                    const showUpdateNotificationSpy = sandbox.spy(updateNotifier, 'showUpdateNotification');
                    const showAutoUpdateNotificationSpy = sandbox.spy(updateNotifier, 'showAutoUpdateNotification');
                    const showErrorNotificationSpy = sandbox.spy(updateNotifier, 'showErrorNotification');
                    const showUpToDateNotificationSpy = sandbox.spy(updateNotifier, 'showUpToDateNotification');

                    (service as any).updateNotifier = updateNotifier;

                    const versionChecker = new VersionChecker();
                    sandbox.stub(versionChecker, 'getLatestRelease').resolves(null);
                    (service as any).versionChecker = versionChecker;

                    service.initialize(mockContext);

                    // Execute
                    await service.checkForUpdates();

                    // Verify: No notifications shown
                    expect(showUpdateNotificationSpy.called).to.be.false;
                    expect(showAutoUpdateNotificationSpy.called).to.be.false;
                    expect(showErrorNotificationSpy.called).to.be.false;
                    expect(showUpToDateNotificationSpy.called).to.be.false;
                }),
                { numRuns: 100 }
            );
        });

        it('should respect airgap mode even when force=false is used', async () => {
            await fc.assert(
                fc.asyncProperty(airgapConfigArbitrary, async (config) => {
                    // Setup
                    getUpdateConfigStub.returns(config);

                    const versionChecker = new VersionChecker();
                    const getLatestReleaseSpy = sandbox.spy(versionChecker, 'getLatestRelease');
                    (service as any).versionChecker = versionChecker;

                    service.initialize(mockContext);

                    // Execute with force=false (default)
                    const result = await service.checkForUpdates(false);

                    // Verify
                    expect(getLatestReleaseSpy.called).to.be.false;
                    expect(result.status).to.equal('skipped');
                }),
                { numRuns: 100 }
            );
        });
    });

    /**
     * Feature: lsp-update-checker, Property 4: Auto-update behavior is determined by configuration
     * Validates: Requirements 5.1, 5.3
     */
    describe('Property 4: Auto-update behavior is determined by configuration', () => {
        // Generator for configurations with different auto-update settings
        const configArbitrary = fc.record({
            airgapMode: fc.constant(false), // Disable airgap for these tests
            autoUpdate: fc.boolean(),
            checkOnStartup: fc.boolean(),
            checkInterval: fc.integer({ min: 1, max: 168 })
        });

        // Generator for version pairs where latest > installed
        const newerVersionArbitrary = fc.tuple(
            fc.tuple(fc.nat({ max: 10 }), fc.nat({ max: 10 }), fc.nat({ max: 10 })),
            fc.integer({ min: 1, max: 5 }) // increment amount
        ).map(([[major, minor, patch], increment]) => {
            const installed = `${major}.${minor}.${patch}`;
            const latest = `${major}.${minor}.${patch + increment}`;
            return { installed, latest };
        });

        it('should automatically install when autoUpdate is true and update is available', async () => {
            await fc.assert(
                fc.asyncProperty(
                    configArbitrary.filter(c => c.autoUpdate === true),
                    newerVersionArbitrary,
                    async (config, versions) => {
                        // Setup
                        getUpdateConfigStub.returns(config);

                        const updateInstaller = new UpdateInstaller(mockContext.extensionPath);
                        sandbox.stub(updateInstaller, 'getInstalledVersion').returns(versions.installed);
                        const installReleaseSpy = sandbox.stub(updateInstaller, 'installRelease').resolves({
                            success: true,
                            version: versions.latest
                        });

                        const versionChecker = new VersionChecker();
                        sandbox.stub(versionChecker, 'isValidVersion').returns(true);
                        sandbox.stub(versionChecker, 'compareVersions').returns(1); // latest > installed
                        sandbox.stub(versionChecker, 'getLatestRelease').resolves({
                            tagName: `v${versions.latest}`,
                            version: versions.latest,
                            releaseUrl: 'https://github.com/test/release',
                            downloadUrl: 'https://github.com/test/download.jar',
                            checksum: 'abc123',
                            publishedAt: new Date().toISOString()
                        });

                        const versionCache = new VersionCache(mockGlobalState, config.checkInterval);

                        const updateNotifier = new UpdateNotifier();
                        const showUpdateNotificationSpy = sandbox.spy(updateNotifier, 'showUpdateNotification');
                        sandbox.stub(updateNotifier, 'showAutoUpdateNotification').resolves();

                        // Inject mocked components
                        (service as any).updateInstaller = updateInstaller;
                        (service as any).versionChecker = versionChecker;
                        (service as any).versionCache = versionCache;
                        (service as any).updateNotifier = updateNotifier;
                        (service as any).context = mockContext;

                        // Execute
                        await service.checkForUpdates();

                        // Verify: Installation was triggered
                        expect(installReleaseSpy.called).to.be.true;
                        
                        // Verify: Regular update notification was NOT shown (auto-update notification shown instead)
                        expect(showUpdateNotificationSpy.called).to.be.false;
                    }
                ),
                { numRuns: 50 } // Reduced runs due to complexity
            );
        });

        it('should only notify when autoUpdate is false and update is available', async () => {
            await fc.assert(
                fc.asyncProperty(
                    configArbitrary.filter(c => c.autoUpdate === false),
                    newerVersionArbitrary,
                    async (config, versions) => {
                        // Setup
                        getUpdateConfigStub.returns(config);

                        const updateInstaller = new UpdateInstaller(mockContext.extensionPath);
                        sandbox.stub(updateInstaller, 'getInstalledVersion').returns(versions.installed);
                        const installReleaseSpy = sandbox.stub(updateInstaller, 'installRelease').resolves({
                            success: true,
                            version: versions.latest
                        });

                        const versionChecker = new VersionChecker();
                        sandbox.stub(versionChecker, 'isValidVersion').returns(true);
                        sandbox.stub(versionChecker, 'compareVersions').returns(1); // latest > installed
                        sandbox.stub(versionChecker, 'getLatestRelease').resolves({
                            tagName: `v${versions.latest}`,
                            version: versions.latest,
                            releaseUrl: 'https://github.com/test/release',
                            downloadUrl: 'https://github.com/test/download.jar',
                            checksum: 'abc123',
                            publishedAt: new Date().toISOString()
                        });

                        const versionCache = new VersionCache(mockGlobalState, config.checkInterval);

                        const updateNotifier = new UpdateNotifier();
                        const showUpdateNotificationSpy = sandbox.stub(updateNotifier, 'showUpdateNotification').resolves('dismissed');
                        const showAutoUpdateNotificationSpy = sandbox.spy(updateNotifier, 'showAutoUpdateNotification');

                        // Inject mocked components
                        (service as any).updateInstaller = updateInstaller;
                        (service as any).versionChecker = versionChecker;
                        (service as any).versionCache = versionCache;
                        (service as any).updateNotifier = updateNotifier;
                        (service as any).context = mockContext;

                        // Execute
                        await service.checkForUpdates();

                        // Verify: Notification was shown
                        expect(showUpdateNotificationSpy.called).to.be.true;
                        
                        // Verify: Auto-update notification was NOT shown
                        expect(showAutoUpdateNotificationSpy.called).to.be.false;
                        
                        // Verify: Installation was NOT automatically triggered (user dismissed)
                        expect(installReleaseSpy.called).to.be.false;
                    }
                ),
                { numRuns: 50 } // Reduced runs due to complexity
            );
        });

        it('should respect autoUpdate setting consistently across multiple checks', async () => {
            await fc.assert(
                fc.asyncProperty(
                    configArbitrary,
                    newerVersionArbitrary,
                    async (config, versions) => {
                        // Setup
                        getUpdateConfigStub.returns(config);

                        const updateInstaller = new UpdateInstaller(mockContext.extensionPath);
                        sandbox.stub(updateInstaller, 'getInstalledVersion').returns(versions.installed);
                        const installReleaseSpy = sandbox.stub(updateInstaller, 'installRelease').resolves({
                            success: true,
                            version: versions.latest
                        });

                        const versionChecker = new VersionChecker();
                        sandbox.stub(versionChecker, 'getLatestRelease').resolves({
                            tagName: `v${versions.latest}`,
                            version: versions.latest,
                            releaseUrl: 'https://github.com/test/release',
                            downloadUrl: 'https://github.com/test/download.jar',
                            checksum: 'abc123',
                            publishedAt: new Date().toISOString()
                        });

                        const versionCache = new VersionCache(mockGlobalState, config.checkInterval);

                        const updateNotifier = new UpdateNotifier();
                        sandbox.stub(updateNotifier, 'showUpdateNotification').resolves('dismissed');
                        sandbox.stub(updateNotifier, 'showAutoUpdateNotification').resolves();

                        // Inject mocked components
                        (service as any).updateInstaller = updateInstaller;
                        (service as any).versionChecker = versionChecker;
                        (service as any).versionCache = versionCache;
                        (service as any).updateNotifier = updateNotifier;
                        (service as any).context = mockContext;

                        // Execute: Perform check twice with force to bypass cache
                        await service.checkForUpdates(true);
                        const firstCallCount = installReleaseSpy.callCount;
                        
                        await service.checkForUpdates(true);
                        const secondCallCount = installReleaseSpy.callCount;

                        // Verify: Behavior is consistent
                        if (config.autoUpdate) {
                            expect(firstCallCount).to.equal(1);
                            expect(secondCallCount).to.equal(2);
                        } else {
                            expect(firstCallCount).to.equal(0);
                            expect(secondCallCount).to.equal(0);
                        }
                    }
                ),
                { numRuns: 50 } // Reduced runs due to complexity
            );
        });
    });
});
