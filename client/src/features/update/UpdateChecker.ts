import { VersionCache } from './VersionCache';
import { ReleaseProvider } from './ReleaseProvider';
import { Clock } from './Clock';
import { UpdateCheckResult } from './UpdateCheckResult';
import { VersionChecker } from './VersionChecker';

/**
 * Orchestrates update checking by coordinating cache, version checking, and release fetching.
 *
 * Provides two check strategies:
 * - `checkForUpdate()`: Cache-first (for automatic background checks)
 * - `checkForUpdateNow()`: Force-check (for manual "Check Now" commands)
 */
export class UpdateChecker {
	private readonly versionChecker: VersionChecker;

	constructor(
		private readonly currentVersion: string,
		private readonly cache: VersionCache,
		private readonly provider: ReleaseProvider,
		private readonly clock: Clock
	) {
		this.versionChecker = new VersionChecker();
	}

	/**
	 * Checks for updates with cache-first strategy.
	 *
	 * Returns cached result if valid and not expired. Fetches from network if
	 * cache miss/expired. Clears cache if provider returns null.
	 *
	 * @returns Update check result
	 */
	async checkForUpdate(): Promise<UpdateCheckResult> {
		try {
			// Check cache first
			const cached = this.cache.getCachedRelease();
			if (cached) {
				return {
					status: 'cache-hit',
					currentVersion: this.currentVersion,
					latestRelease: cached.release,
					checkedAt: cached.checkedAt,
					source: 'cache'
				};
			}

			// Cache miss or expired - fetch from network
			const latestRelease = await this.provider.fetchLatestRelease();

			if (latestRelease === null) {
				// Clear cache when provider fails (don't persist stale data)
				await this.cache.clear();

				return {
					status: 'unknown',
					currentVersion: this.currentVersion,
					latestRelease: null,
					checkedAt: this.clock.now(),
					source: 'network'
				};
			}

			// Update cache with fresh data
			await this.cache.setCachedRelease(latestRelease);

			// Compare versions
			const status = this.determineStatus(latestRelease.version);

			return {
				status,
				currentVersion: this.currentVersion,
				latestRelease,
				checkedAt: this.clock.now(),
				source: 'network'
			};
		} catch (error) {
			// Clear cache on error (don't persist stale data)
			await this.cache.clear();

			return {
				status: 'error',
				currentVersion: this.currentVersion,
				latestRelease: null,
				checkedAt: this.clock.now(),
				source: 'network',
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	/**
	 * Determines the update status by comparing current and latest versions.
	 */
	private determineStatus(latestVersion: string): 'up-to-date' | 'update-available' | 'unknown' {
		// Check if current version is valid
		if (!this.versionChecker.isValidVersion(this.currentVersion)) {
			return 'unknown';
		}

		// Compare versions
		const comparison = this.versionChecker.compareVersions(this.currentVersion, latestVersion);

		if (comparison < 0) {
			return 'update-available';
		}

		return 'up-to-date';
	}

	/**
	 * Checks for updates bypassing cache (force-check).
	 *
	 * Always fetches from network, bypassing cache. Preserves cache on failure
	 * (user wants to see last good data). Updates cache on successful fetch.
	 *
	 * @returns Update check result
	 */
	async checkForUpdateNow(): Promise<UpdateCheckResult> {
		try {
			// Always fetch from network, bypass cache
			const latestRelease = await this.provider.fetchLatestRelease();

			if (latestRelease === null) {
				// For manual checks, preserve cache (don't clear)
				// User wants to see last known good data
				return {
					status: 'unknown',
					currentVersion: this.currentVersion,
					latestRelease: null,
					checkedAt: this.clock.now(),
					source: 'network'
				};
			}

			// Update cache with fresh data
			await this.cache.setCachedRelease(latestRelease);

			// Compare versions
			const status = this.determineStatus(latestRelease.version);

			return {
				status,
				currentVersion: this.currentVersion,
				latestRelease,
				checkedAt: this.clock.now(),
				source: 'network'
			};
		} catch (error) {
			// For manual checks, preserve cache (user wants last good data)
			return {
				status: 'error',
				currentVersion: this.currentVersion,
				latestRelease: null,
				checkedAt: this.clock.now(),
				source: 'network',
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
}
