import { expect } from 'chai';
import * as sinon from 'sinon';
import proxyquire = require('proxyquire');
import type { LibraryDownloader as LibraryDownloaderType } from '../../../../src/services/jenkins/LibraryDownloader';

describe('LibraryDownloader', () => {
    let mockSimpleGit: any;
    let mockFs: any;
    let LibraryDownloader: typeof LibraryDownloaderType;
    let downloader: LibraryDownloaderType;
    let globalStoragePath: string;

    beforeEach(() => {
        // Mock simple-git
        mockSimpleGit = sinon.stub().returns({
            clone: sinon.stub().resolves(),
            pull: sinon.stub().resolves(),
            checkout: sinon.stub().resolves(),
            branch: sinon.stub().resolves({ current: 'master' })
        });

        // Mock fs
        mockFs = {
            existsSync: sinon.stub(),
            mkdirSync: sinon.stub()
        };

        // Load LibraryDownloader with mocks
        const module = proxyquire.noCallThru()('../../../../src/services/jenkins/LibraryDownloader', {
            'simple-git': { simpleGit: mockSimpleGit },
            'fs': mockFs
        });

        LibraryDownloader = module.LibraryDownloader;
        globalStoragePath = '/mock/global/storage';
        downloader = new LibraryDownloader(globalStoragePath);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('download', () => {
        it('should clone repository if folder does not exist', async () => {
            const library = {
                name: 'my-lib',
                url: 'https://github.com/org/repo.git',
                branch: 'master'
            };

            mockFs.existsSync.returns(false);
            const git = mockSimpleGit();

            await downloader.download(library);

            expect(mockFs.existsSync.calledOnce).to.be.true;
            expect(mockFs.existsSync.firstCall.args[0]).to.include('my-lib');
            expect(git.clone.calledOnce).to.be.true;
            expect(git.clone.firstCall.args[0]).to.equal(library.url);
            expect(git.clone.firstCall.args[1]).to.include('my-lib');
            expect(git.clone.firstCall.args[2]).to.deep.include({ '--branch': 'master' });
        });

        it('should pull changes if folder exists and on correct branch', async () => {
            const library = {
                name: 'existing-lib',
                url: 'https://github.com/org/repo.git',
                branch: 'master'
            };

            mockFs.existsSync.returns(true);
            const git = mockSimpleGit();

            await downloader.download(library);

            expect(mockFs.existsSync.calledOnce).to.be.true;
            expect(git.pull.calledOnce).to.be.true;
        });

        it('should checkout branch if folder exists but on different branch', async () => {
            const library = {
                name: 'existing-lib',
                url: 'https://github.com/org/repo.git',
                branch: 'develop'
            };

            mockFs.existsSync.returns(true);
            const git = {
                branch: sinon.stub().resolves({ current: 'master' }),
                checkout: sinon.stub().resolves(),
                pull: sinon.stub().resolves()
            };
            mockSimpleGit.returns(git);

            await downloader.download(library);

            expect(git.checkout.calledOnce).to.be.true;
            expect(git.checkout.firstCall.args[0]).to.equal('develop');
            expect(git.pull.calledOnce).to.be.true;
        });

        it('should handle git clone errors gracefully', async () => {
            const library = {
                name: 'error-lib',
                url: 'https://github.com/org/invalid.git',
                branch: 'master'
            };

            mockFs.existsSync.returns(false);
            const git = {
                clone: sinon.stub().rejects(new Error('Clone failed'))
            };
            mockSimpleGit.returns(git);

            try {
                await downloader.download(library);
                expect.fail('Should have thrown an error');
            } catch (error: any) {
                expect(error.message).to.contain('Failed to download library');
                expect(error.message).to.contain('error-lib');
            }
        });

        it('should handle git pull errors gracefully', async () => {
            const library = {
                name: 'pull-error-lib',
                url: 'https://github.com/org/repo.git',
                branch: 'master'
            };

            mockFs.existsSync.returns(true);
            const git = {
                branch: sinon.stub().resolves({ current: 'master' }),
                pull: sinon.stub().rejects(new Error('Pull failed'))
            };
            mockSimpleGit.returns(git);

            try {
                await downloader.download(library);
                expect.fail('Should have thrown an error');
            } catch (error: any) {
                expect(error.message).to.contain('Failed to update library');
                expect(error.message).to.contain('pull-error-lib');
            }
        });
    });
});
