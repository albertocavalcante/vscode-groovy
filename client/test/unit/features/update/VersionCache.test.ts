import { expect } from 'chai';
import * as vscode from 'vscode';
import { VersionCache, CachedRelease } from '../../../../src/features/update/VersionCache';
import { ReleaseInfo } from '../../../../src/features/update/VersionChecker';

describe('VersionCache - Unit Tests', () => {
    let mockGlobalState: vscode.Memento;
    let storage: Map<string, any>;

    beforeEach(() => {
        storage = new Map<string, any>();
        mockGlobalState = {
            get: <T>(key: string): T | undefined => storage.get(key) as T | undefined,
            update: async (key: string, value: any): Promise<void> => {
                storage.set(key, value);
            },
            keys: () => Array.from(storage.keys())
        };
    });

    const createSampleRelease = (): ReleaseInfo => ({
        tagName: 'v0.2.0',
        version: '0.2.0',
        releaseUrl: 'https://github.com/test/release',
        downloadUrl: 'https://github.com/test/download.jar',
        checksum: 'abc123',
        publishedAt: '2024-01-01T00:00:00Z'
    });

    describe('getCachedRelease', () => {
        it('should return null when cache is empty', () => {
            const cache = new VersionCache(mockGlobalState, 24);
            const result = cache.getCachedRelease();
            expect(result).to.be.null;
        });

        it('should return cached release when valid', async () => {
            const cache = new VersionCache(mockGlobalState, 24);
            const release = createSampleRelease();

            await cache.setCachedRelease(release);
            const cached = cache.getCachedRelease();

            expect(cached).to.not.be.null;
            expect(cached?.release).to.deep.equal(release);
        });

        it('should return null when cache has expired', async () => {
            const cache = new VersionCache(mockGlobalState, 24);
            const release = createSampleRelease();

            await cache.setCachedRelease(release);

            // Manually expire the cache
            const stored = storage.get('groovy.update.cachedRelease') as CachedRelease;
            stored.expiresAt = Date.now() - 1000; // Expired 1 second ago
            storage.set('groovy.update.cachedRelease', stored);

            const cached = cache.getCachedRelease();
            expect(cached).to.be.null;
        });
    });

    describe('setCachedRelease', () => {
        it('should store release with correct timestamps', async () => {
            const cache = new VersionCache(mockGlobalState, 24);
            const release = createSampleRelease();

            const beforeSet = Date.now();
            await cache.setCachedRelease(release);
            const afterSet = Date.now();

            const cached = cache.getCachedRelease();

            expect(cached).to.not.be.null;
            expect(cached?.release).to.deep.equal(release);
            expect(cached?.checkedAt).to.be.at.least(beforeSet);
            expect(cached?.checkedAt).to.be.at.most(afterSet);
        });

        it('should calculate expiration based on check interval', async () => {
            const checkIntervalHours = 48;
            const cache = new VersionCache(mockGlobalState, checkIntervalHours);
            const release = createSampleRelease();

            const beforeSet = Date.now();
            await cache.setCachedRelease(release);

            const cached = cache.getCachedRelease();
            const expectedExpiration = beforeSet + (checkIntervalHours * 60 * 60 * 1000);

            expect(cached?.expiresAt).to.be.at.least(expectedExpiration);
            expect(cached?.expiresAt).to.be.at.most(expectedExpiration + 1000); // Allow 1s tolerance
        });

        it('should overwrite existing cache', async () => {
            const cache = new VersionCache(mockGlobalState, 24);
            const release1 = createSampleRelease();
            const release2 = { ...createSampleRelease(), version: '0.3.0', tagName: 'v0.3.0' };

            await cache.setCachedRelease(release1);
            await cache.setCachedRelease(release2);

            const cached = cache.getCachedRelease();
            expect(cached?.release.version).to.equal('0.3.0');
        });
    });

    describe('clear', () => {
        it('should remove cached data', async () => {
            const cache = new VersionCache(mockGlobalState, 24);
            const release = createSampleRelease();

            await cache.setCachedRelease(release);
            expect(cache.getCachedRelease()).to.not.be.null;

            await cache.clear();
            expect(cache.getCachedRelease()).to.be.null;
        });

        it('should not throw when clearing empty cache', async () => {
            const cache = new VersionCache(mockGlobalState, 24);
            await cache.clear();
            expect(cache.getCachedRelease()).to.be.null;
        });
    });

    describe('isExpired', () => {
        it('should return false for non-expired cache', async () => {
            const cache = new VersionCache(mockGlobalState, 24);
            const release = createSampleRelease();

            await cache.setCachedRelease(release);
            const cached = cache.getCachedRelease();

            expect(cached).to.not.be.null;
            expect(cache.isExpired(cached!)).to.be.false;
        });

        it('should return true for expired cache', () => {
            const cache = new VersionCache(mockGlobalState, 24);
            const expiredCache: CachedRelease = {
                release: createSampleRelease(),
                checkedAt: Date.now() - 48 * 60 * 60 * 1000, // 48 hours ago
                expiresAt: Date.now() - 1000 // Expired 1 second ago
            };

            expect(cache.isExpired(expiredCache)).to.be.true;
        });

        it('should return true when expiresAt equals current time', () => {
            const cache = new VersionCache(mockGlobalState, 24);
            const now = Date.now();
            const expiredCache: CachedRelease = {
                release: createSampleRelease(),
                checkedAt: now - 24 * 60 * 60 * 1000,
                expiresAt: now
            };

            expect(cache.isExpired(expiredCache)).to.be.true;
        });
    });

    describe('persistence to globalState', () => {
        it('should persist data to globalState', async () => {
            const cache = new VersionCache(mockGlobalState, 24);
            const release = createSampleRelease();

            await cache.setCachedRelease(release);

            // Verify data is in storage
            expect(storage.has('groovy.update.cachedRelease')).to.be.true;
            const stored = storage.get('groovy.update.cachedRelease') as CachedRelease;
            expect(stored.release).to.deep.equal(release);
        });

        it('should retrieve data from globalState across instances', async () => {
            const cache1 = new VersionCache(mockGlobalState, 24);
            const release = createSampleRelease();

            await cache1.setCachedRelease(release);

            // Create new instance with same globalState
            const cache2 = new VersionCache(mockGlobalState, 24);
            const cached = cache2.getCachedRelease();

            expect(cached?.release).to.deep.equal(release);
        });

        it('should clear data from globalState', async () => {
            const cache = new VersionCache(mockGlobalState, 24);
            const release = createSampleRelease();

            await cache.setCachedRelease(release);
            expect(storage.has('groovy.update.cachedRelease')).to.be.true;

            await cache.clear();
            expect(storage.get('groovy.update.cachedRelease')).to.be.undefined;
        });
    });

    describe('check interval validation', () => {
        it('should enforce minimum check interval of 1 hour', async () => {
            const cache = new VersionCache(mockGlobalState, 0);
            const release = createSampleRelease();

            const beforeSet = Date.now();
            await cache.setCachedRelease(release);

            const cached = cache.getCachedRelease();
            const minimumExpiration = beforeSet + (1 * 60 * 60 * 1000);

            expect(cached?.expiresAt).to.be.at.least(minimumExpiration);
        });

        it('should enforce minimum check interval for negative values', async () => {
            const cache = new VersionCache(mockGlobalState, -10);
            const release = createSampleRelease();

            const beforeSet = Date.now();
            await cache.setCachedRelease(release);

            const cached = cache.getCachedRelease();
            const minimumExpiration = beforeSet + (1 * 60 * 60 * 1000);

            expect(cached?.expiresAt).to.be.at.least(minimumExpiration);
        });

        it('should accept valid check intervals', async () => {
            const cache = new VersionCache(mockGlobalState, 72);
            const release = createSampleRelease();

            const beforeSet = Date.now();
            await cache.setCachedRelease(release);

            const cached = cache.getCachedRelease();
            const expectedExpiration = beforeSet + (72 * 60 * 60 * 1000);

            expect(cached?.expiresAt).to.be.at.least(expectedExpiration);
        });
    });
});
