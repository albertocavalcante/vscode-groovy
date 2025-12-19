import { ReleaseInfo } from './VersionChecker';

/**
 * Abstraction for fetching the latest release information.
 *
 * Implementations should return `null` for all error cases (network failures,
 * invalid responses, etc.) rather than throwing exceptions. This allows the
 * UpdateChecker to handle errors gracefully without try-catch at every call site.
 */
export interface ReleaseProvider {
	/**
	 * Fetches the latest release information from the configured source.
	 *
	 * @returns The latest release info, or `null` if unavailable or on error.
	 */
	fetchLatestRelease(): Promise<ReleaseInfo | null>;
}
