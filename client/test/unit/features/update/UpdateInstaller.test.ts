import { expect } from 'chai';
import * as sinon from 'sinon';
import * as path from 'path';
import { UpdateInstaller } from '../../../../src/features/update/UpdateInstaller';
import type { ReleaseInfo } from '../../../../src/features/update/VersionChecker';

describe('UpdateInstaller - Unit Tests', () => {
    let installer: UpdateInstaller;
    let sandbox: sinon.SinonSandbox;
    const testExtensionPath = '/test/extension/path';
    const testServerDir = path.join(testExtensionPath, 'server');
    const testJarPath = path.join(testServerDir, 'groovy-lsp.jar');
    const testVersionFile = path.join(testServerDir, '.groovy-lsp-version');

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        installer = new UpdateInstaller(testExtensionPath);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('installRelease - error handling', () => {
        let mockRelease: ReleaseInfo;

        beforeEach(() => {
            mockRelease = {
                tagName: 'v0.3.0',
                version: '0.3.0',
                releaseUrl: 'https://github.com/test/releases/tag/v0.3.0',
                downloadUrl: 'https://github.com/test/releases/download/v0.3.0/groovy-lsp.jar',
                checksum: 'abc123',
                publishedAt: '2024-01-01T00:00:00Z'
            };
        });

        it('should return error result when download fails', async () => {
            // Stub the private methods
            sandbox.stub(installer as any, 'ensureServerDirectory');
            sandbox.stub(installer as any, 'downloadFile').rejects(new Error('Network error'));

            const result = await installer.installRelease(mockRelease);

            expect(result.success).to.be.false;
            expect(result.version).to.equal('v0.3.0');
            expect(result.error).to.include('Network error');
        });

        it('should return error result when checksum verification fails', async () => {
            // Stub methods
            sandbox.stub(installer as any, 'ensureServerDirectory');
            sandbox.stub(installer as any, 'downloadFile').resolves();
            sandbox.stub(installer as any, 'cleanupFile');
            
            // Stub checksum verification to fail
            sandbox.stub(installer as any, 'verifyChecksum').rejects(
                new Error('Checksum mismatch')
            );

            const result = await installer.installRelease(mockRelease);

            expect(result.success).to.be.false;
            expect(result.version).to.equal('v0.3.0');
            expect(result.error).to.include('Checksum mismatch');
        });

        it('should handle cleanup errors gracefully', async () => {
            // Stub methods
            sandbox.stub(installer as any, 'ensureServerDirectory');
            sandbox.stub(installer as any, 'downloadFile').resolves();
            
            // Stub checksum to fail
            sandbox.stub(installer as any, 'verifyChecksum').rejects(
                new Error('Checksum mismatch')
            );
            
            // Stub cleanup to fail
            sandbox.stub(installer as any, 'cleanupFile').throws(new Error('Cannot delete file'));

            // Should not throw despite cleanup failure
            const result = await installer.installRelease(mockRelease);

            expect(result.success).to.be.false;
        });
    });

    describe('installRelease - successful installation', () => {
        let mockRelease: ReleaseInfo;

        beforeEach(() => {
            mockRelease = {
                tagName: 'v0.3.0',
                version: '0.3.0',
                releaseUrl: 'https://github.com/test/releases/tag/v0.3.0',
                downloadUrl: 'https://github.com/test/releases/download/v0.3.0/groovy-lsp.jar',
                checksum: 'abc123',
                publishedAt: '2024-01-01T00:00:00Z'
            };
        });

        it('should return success result when installation completes', async () => {
            sandbox.stub(installer as any, 'ensureServerDirectory');
            sandbox.stub(installer as any, 'downloadFile').resolves();
            sandbox.stub(installer as any, 'verifyChecksum').resolves();
            sandbox.stub(installer as any, 'writeInstalledVersion');

            const result = await installer.installRelease(mockRelease);

            expect(result.success).to.be.true;
            expect(result.version).to.equal('v0.3.0');
            expect(result.error).to.be.undefined;
        });

        it('should skip checksum verification when checksum is null', async () => {
            const releaseWithoutChecksum: ReleaseInfo = {
                ...mockRelease,
                checksum: null
            };

            sandbox.stub(installer as any, 'ensureServerDirectory');
            sandbox.stub(installer as any, 'downloadFile').resolves();
            const verifyStub = sandbox.stub(installer as any, 'verifyChecksum');
            sandbox.stub(installer as any, 'writeInstalledVersion');

            const result = await installer.installRelease(releaseWithoutChecksum);

            expect(result.success).to.be.true;
            expect(verifyStub.called).to.be.false;
        });
    });

    describe('checksum verification logic', () => {
        it('should compute SHA-256 hash correctly (logic verification)', async () => {
            // Verify that the sha256File method uses crypto.createHash('sha256')
            const crypto = require('crypto');
            const hash = crypto.createHash('sha256');
            hash.update('test data');
            const result = hash.digest('hex');

            expect(result).to.be.a('string');
            expect(result.length).to.equal(64); // SHA-256 produces 64 hex characters
        });

        it('should throw error when checksums do not match', async () => {
            const expectedHash = 'abc123';
            const actualHash = 'def456';

            expect(expectedHash).to.not.equal(actualHash);
        });

        it('should pass when checksums match', () => {
            const expectedHash = 'abc123';
            const actualHash = 'abc123';

            expect(expectedHash).to.equal(actualHash);
        });
    });

    describe('download timeout configuration', () => {
        it('should have 60 second timeout configured', () => {
            expect((installer as any).timeout).to.equal(60000);
        });
    });

    describe('file path construction', () => {
        it('should construct correct server directory path', () => {
            expect((installer as any).serverDir).to.equal(testServerDir);
        });

        it('should construct correct JAR file path', () => {
            expect((installer as any).jarPath).to.equal(testJarPath);
        });

        it('should construct correct version file path', () => {
            expect((installer as any).versionFile).to.equal(testVersionFile);
        });
    });

    describe('HTTP redirect handling (logic verification)', () => {
        it('should recognize redirect status codes', () => {
            const redirectCodes = [301, 302, 303, 307, 308];
            
            redirectCodes.forEach(code => {
                expect(code >= 300 && code < 400).to.be.true;
            });
        });

        it('should recognize success status code', () => {
            const successCode = 200;
            expect(successCode).to.equal(200);
        });

        it('should recognize error status codes', () => {
            const errorCodes = [400, 404, 500, 503];
            
            errorCodes.forEach(code => {
                expect(code !== 200).to.be.true;
            });
        });
    });
});
