import { expect } from 'chai';
import * as sinon from 'sinon';
import proxyquire = require('proxyquire');
import type { SharedLibraryManager as SharedLibraryManagerType } from '../../../../src/services/jenkins/SharedLibraryManager';

describe('SharedLibraryManager', () => {
    let mockDownloader: any;
    let mockResolver: any;
    let mockClient: any;
    let mockGetConfig: sinon.SinonStub;
    let SharedLibraryManager: typeof SharedLibraryManagerType;
    let manager: SharedLibraryManagerType;

    beforeEach(() => {
        // Mock LibraryDownloader
        mockDownloader = {
            download: sinon.stub().resolves()
        };

        // Mock ClasspathResolver
        mockResolver = {
            resolveClasspaths: sinon.stub().returns([])
        };

        // Mock configuration
        mockGetConfig = sinon.stub().returns([]);

        // Mock LanguageClient
        mockClient = {
            sendNotification: sinon.stub().resolves()
        };

        // Load SharedLibraryManager with mocks
        const module = proxyquire.noCallThru()('../../../../src/services/jenkins/SharedLibraryManager', {
            './LibraryDownloader': { LibraryDownloader: sinon.stub().returns(mockDownloader) },
            './ClasspathResolver': { ClasspathResolver: sinon.stub().returns(mockResolver) },
            '../../configuration/jenkinsLibraries': { getJenkinsLibrariesConfiguration: mockGetConfig }
        });

        SharedLibraryManager = module.SharedLibraryManager;
        manager = new SharedLibraryManager('/mock/storage', mockClient);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('initialize', () => {
        it('should download libraries and send notification to LSP on initialization', async () => {
            const libraries = [
                { name: 'lib1', url: 'https://github.com/org/lib1.git', branch: 'master' }
            ];
            const classpaths = ['/mock/storage/lib1/src', '/mock/storage/lib1/vars'];

            mockGetConfig.returns(libraries);
            mockResolver.resolveClasspaths.returns(classpaths);

            await manager.initialize();

            expect(mockDownloader.download.calledOnce).to.be.true;
            expect(mockDownloader.download.firstCall.args[0]).to.deep.equal(libraries[0]);
            expect(mockResolver.resolveClasspaths.calledOnce).to.be.true;
            expect(mockResolver.resolveClasspaths.firstCall.args[0]).to.deep.equal(libraries);
            expect(mockClient.sendNotification.calledOnce).to.be.true;
            expect(mockClient.sendNotification.firstCall.args[0]).to.equal('workspace/didChangeConfiguration');
            expect(mockClient.sendNotification.firstCall.args[1]).to.deep.equal({
                settings: {
                    externalClasspaths: classpaths
                }
            });
        });

        it('should handle multiple libraries', async () => {
            const libraries = [
                { name: 'lib1', url: 'https://github.com/org/lib1.git', branch: 'master' },
                { name: 'lib2', url: 'https://github.com/org/lib2.git', branch: 'main' }
            ];

            mockGetConfig.returns(libraries);

            await manager.initialize();

            expect(mockDownloader.download.calledTwice).to.be.true;
            expect(mockDownloader.download.firstCall.args[0]).to.deep.equal(libraries[0]);
            expect(mockDownloader.download.secondCall.args[0]).to.deep.equal(libraries[1]);
        });

        it('should not send notification when no libraries are configured', async () => {
            mockGetConfig.returns([]);

            await manager.initialize();

            expect(mockDownloader.download.notCalled).to.be.true;
            expect(mockClient.sendNotification.notCalled).to.be.true;
        });

        it('should handle download errors gracefully', async () => {
            const libraries = [
                { name: 'lib1', url: 'https://github.com/org/lib1.git', branch: 'master' },
                { name: 'lib2', url: 'https://github.com/org/lib2.git', branch: 'main' }
            ];

            mockGetConfig.returns(libraries);
            mockDownloader.download
                .onFirstCall().rejects(new Error('Download failed'))
                .onSecondCall().resolves();

            // Should not throw, but log error
            await manager.initialize();

            // Second library should still be attempted
            expect(mockDownloader.download.calledTwice).to.be.true;
        });
    });

    describe('refresh', () => {
        it('should re-download libraries and update classpaths', async () => {
            const libraries = [
                { name: 'lib1', url: 'https://github.com/org/lib1.git', branch: 'master' }
            ];
            const classpaths = ['/mock/storage/lib1/src'];

            mockGetConfig.returns(libraries);
            mockResolver.resolveClasspaths.returns(classpaths);

            await manager.refresh();

            expect(mockDownloader.download.calledOnce).to.be.true;
            expect(mockClient.sendNotification.calledOnce).to.be.true;
        });
    });
});
