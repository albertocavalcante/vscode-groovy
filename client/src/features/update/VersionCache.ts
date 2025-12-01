import * as vscode from 'vscode';
import { ReleaseInfo } from './VersionChecker';

/**
 * Cached release information with expiration
 */
export interface CachedRelease {
    release: ReleaseInfo;
    checkedAt: number;
    expiresAt: number;
}

/**
 * Manages caching of version check results to avoid excessive API calls
 */
export class VersionCache {
    private static readonly CACHE_KEY = 'groovy.update.cachedRelease';
    private readonly globalState: vscode.Memento;
    private readonly checkIntervalHours: number;

    /**
     * Creates a new VersionCache instance
     * @param globalState - VS Code global state for persistence
     * @param checkIntervalHours - Hours between checks (default 24)
     */
    constructor(globalState: vscode.Memento, checkIntervalHours: number = 24) {
        this.globalState = globalState;
        this.checkIntervalHours = Math.max(1, checkIntervalHours); // Minimum 1 hour
    }

    /**
     * Gets cached release info if still valid
     * @returns CachedRelease if cache is valid, null otherwise
     */
    getCachedRelease(): CachedRelease | null {
        const cached = this.globalState.get<CachedRelease>(VersionCache.CACHE_KEY);
        
        if (!cached) {
            return null;
        }

        // Check if cache has expired
        if (this.isExpired(cached)) {
            return null;
        }

        return cached;
    }

    /**
     * Stores release info with timestamp
     * @param release - Release information to cache
     */
    async setCachedRelease(release: ReleaseInfo): Promise<void> {
        const now = Date.now();
        const expiresAt = now + (this.checkIntervalHours * 60 * 60 * 1000);

        const cached: CachedRelease = {
            release,
            checkedAt: now,
            expiresAt
        };

        await this.globalState.update(VersionCache.CACHE_KEY, cached);
    }

    /**
     * Clears the cache
     */
    async clear(): Promise<void> {
        await this.globalState.update(VersionCache.CACHE_KEY, undefined);
    }

    /**
     * Checks if a cached release has expired
     * @param cached - Cached release to check
     * @returns true if expired, false otherwise
     */
    isExpired(cached: CachedRelease): boolean {
        return Date.now() >= cached.expiresAt;
    }
}
