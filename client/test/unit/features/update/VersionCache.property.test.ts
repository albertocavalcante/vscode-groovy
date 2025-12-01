import { expect } from 'chai';
import * as fc from 'fast-check';
import * as vscode from 'vscode';
import { VersionCache, CachedRelease } from '../../../../src/features/update/VersionCache';
import { ReleaseInfo } from '../../../../src/features/update/VersionChecker';

describe('VersionCache - Property-Based Tests', () => {
    /**
     * Feature: lsp-update-checker, Property 5: Cache prevents redundant checks within interval
     * Validates: Requirements 7.1
     */
    describe('Property 5: Cache prevents redundant checks within interval', () => {
        // Generator for ReleaseInfo
        const releaseInfoArbitrary: fc.Arbitrary<ReleaseInfo> = fc.record({
            tagName: fc.string({ minLength: 1, maxLength: 20 }),
            version: fc.tuple(
                fc.nat({ max: 100 }),
                fc.nat({ max: 100 }),
                fc.nat({ max: 100 })
            ).map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
            releaseUrl: fc.constant('https://github.com/test/release'),
            downloadUrl: fc.constant('https://github.com/test/download.jar'),
            checksum: fc.oneof(
                fc.constant(null),
                fc.constant('a'.repeat(64))
            ),
            publishedAt: fc.constant(new Date().toISOString())
        }) as fc.Arbitrary<ReleaseInfo>;

        // Generator for check interval in hours (1-168 hours = 1 week)
        const checkIntervalArbitrary = fc.integer({ min: 1, max: 168 });

        // Helper to create mock globalState
        function createMockGlobalState(): { state: vscode.Memento; storage: Map<string, any> } {
            const storage = new Map<string, any>();
            const state: vscode.Memento = {
                get: <T>(key: string): T | undefined => storage.get(key) as T | undefined,
                update: async (key: string, value: any): Promise<void> => {
                    storage.set(key, value);
                },
                keys: () => Array.from(storage.keys())
            };
            return { state, storage };
        }

        it('should return cached release when accessed within the check interval', async () => {
            await fc.assert(
                fc.asyncProperty(
                    releaseInfoArbitrary,
                    checkIntervalArbitrary,
                    async (release, checkIntervalHours) => {
                        const { state } = createMockGlobalState();
                        const cache = new VersionCache(state, checkIntervalHours);

                        // Store a release
                        await cache.setCachedRelease(release);

                        // Immediately retrieve it (should be valid)
                        const cached = cache.getCachedRelease();

                        expect(cached).to.not.be.null;
                        expect(cached?.release).to.deep.equal(release);
                        expect(cached?.checkedAt).to.be.a('number');
                        expect(cached?.expiresAt).to.be.a('number');
                        expect(cached?.expiresAt).to.be.greaterThan(cached?.checkedAt || 0);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should return null when cache has expired', async () => {
            await fc.assert(
                fc.asyncProperty(
                    releaseInfoArbitrary,
                    fc.integer({ min: 1, max: 10 }), // Small interval for testing
                    async (release, checkIntervalHours) => {
                        const { state, storage } = createMockGlobalState();
                        const cache = new VersionCache(state, checkIntervalHours);

                        // Store a release
                        await cache.setCachedRelease(release);

                        // Manually expire the cache by modifying the stored value
                        const stored = storage.get('groovy.update.cachedRelease') as CachedRelease;
                        if (stored) {
                            stored.expiresAt = Date.now() - 1000; // Expired 1 second ago
                            storage.set('groovy.update.cachedRelease', stored);
                        }

                        // Try to retrieve it (should be null because expired)
                        const cached = cache.getCachedRelease();

                        expect(cached).to.be.null;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should calculate expiration time correctly based on check interval', async () => {
            await fc.assert(
                fc.asyncProperty(
                    releaseInfoArbitrary,
                    checkIntervalArbitrary,
                    async (release, checkIntervalHours) => {
                        const { state } = createMockGlobalState();
                        const cache = new VersionCache(state, checkIntervalHours);

                        const beforeSet = Date.now();
                        await cache.setCachedRelease(release);
                        const afterSet = Date.now();

                        const cached = cache.getCachedRelease();

                        expect(cached).to.not.be.null;

                        // Check that expiration is approximately checkIntervalHours in the future
                        const expectedExpirationMin = beforeSet + (checkIntervalHours * 60 * 60 * 1000);
                        const expectedExpirationMax = afterSet + (checkIntervalHours * 60 * 60 * 1000);

                        expect(cached?.expiresAt).to.be.at.least(expectedExpirationMin);
                        expect(cached?.expiresAt).to.be.at.most(expectedExpirationMax);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should return null after clear() is called', async () => {
            await fc.assert(
                fc.asyncProperty(
                    releaseInfoArbitrary,
                    checkIntervalArbitrary,
                    async (release, checkIntervalHours) => {
                        const { state } = createMockGlobalState();
                        const cache = new VersionCache(state, checkIntervalHours);

                        // Store a release
                        await cache.setCachedRelease(release);

                        // Verify it's cached
                        expect(cache.getCachedRelease()).to.not.be.null;

                        // Clear the cache
                        await cache.clear();

                        // Verify it's gone
                        const cached = cache.getCachedRelease();
                        expect(cached).to.be.null;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should enforce minimum check interval of 1 hour', async () => {
            await fc.assert(
                fc.asyncProperty(
                    releaseInfoArbitrary,
                    fc.integer({ min: -100, max: 0 }), // Invalid intervals
                    async (release, invalidInterval) => {
                        const { state } = createMockGlobalState();
                        const cache = new VersionCache(state, invalidInterval);

                        const beforeSet = Date.now();
                        await cache.setCachedRelease(release);

                        const cached = cache.getCachedRelease();

                        expect(cached).to.not.be.null;

                        // Should use minimum of 1 hour (3600000 ms)
                        const minimumExpiration = beforeSet + (1 * 60 * 60 * 1000);
                        expect(cached?.expiresAt).to.be.at.least(minimumExpiration);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should persist data across multiple VersionCache instances with same globalState', async () => {
            await fc.assert(
                fc.asyncProperty(
                    releaseInfoArbitrary,
                    checkIntervalArbitrary,
                    async (release, checkIntervalHours) => {
                        const { state } = createMockGlobalState();

                        // Create first cache instance and store data
                        const cache1 = new VersionCache(state, checkIntervalHours);
                        await cache1.setCachedRelease(release);

                        // Create second cache instance with same globalState
                        const cache2 = new VersionCache(state, checkIntervalHours);
                        const cached = cache2.getCachedRelease();

                        // Should retrieve the same data
                        expect(cached).to.not.be.null;
                        expect(cached?.release).to.deep.equal(release);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
