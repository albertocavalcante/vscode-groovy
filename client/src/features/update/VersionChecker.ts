import * as https from 'https';

/**
 * Release information from GitHub
 */
export interface ReleaseInfo {
    tagName: string;
    version: string;
    releaseUrl: string;
    downloadUrl: string;
    checksum: string | null;
    publishedAt: string;
}

/**
 * Handles GitHub API communication and semantic version comparison
 */
export class VersionChecker {
    private readonly githubApiBase = 'https://api.github.com/repos/albertocavalcante/groovy-lsp';
    private readonly timeout = 30000; // 30 seconds

    /**
     * Fetches the latest release info from GitHub
     */
    async getLatestRelease(): Promise<ReleaseInfo | null> {
        try {
            const releaseData = await this.fetchJson(`${this.githubApiBase}/releases/latest`);
            
            if (!releaseData || !releaseData.tag_name) {
                return null;
            }

            // Find JAR asset (prefer linux-amd64/universal)
            const jarAsset = this.selectJarAsset(releaseData.assets || []);
            if (!jarAsset) {
                return null;
            }

            // Try to fetch checksum
            const checksum = await this.fetchChecksumForAsset(
                releaseData.assets || [],
                jarAsset.name
            );

            return {
                tagName: releaseData.tag_name,
                version: this.normalizeVersion(releaseData.tag_name),
                releaseUrl: releaseData.html_url,
                downloadUrl: jarAsset.browser_download_url,
                checksum,
                publishedAt: releaseData.published_at
            };
        } catch (error) {
            // Network errors should be handled gracefully
            console.error('Failed to fetch latest release:', error);
            return null;
        }
    }

    /**
     * Compares two semantic versions
     * @returns positive if a > b, negative if a < b, 0 if equal
     */
    compareVersions(a: string, b: string): number {
        const aParts = this.parseVersion(a);
        const bParts = this.parseVersion(b);

        if (!aParts || !bParts) {
            return 0; // Cannot compare invalid versions
        }

        // Compare major, minor, patch in order
        for (let i = 0; i < 3; i++) {
            if (aParts[i] > bParts[i]) {
                return 1;
            }
            if (aParts[i] < bParts[i]) {
                return -1;
            }
        }

        return 0; // Versions are equal
    }

    /**
     * Checks if a version string is valid for comparison
     */
    isValidVersion(version: string): boolean {
        if (!version || typeof version !== 'string') {
            return false;
        }

        // "local" or "unknown" versions are not valid for comparison
        const normalized = version.toLowerCase().trim();
        if (normalized === 'local' || normalized === 'unknown' || normalized === '') {
            return false;
        }

        // Must match semver format (with optional 'v' prefix)
        return this.parseVersion(version) !== null;
    }

    /**
     * Normalizes a version string by removing 'v' prefix
     */
    private normalizeVersion(version: string): string {
        if (!version || typeof version !== 'string') {
            return '';
        }
        return version.startsWith('v') ? version.substring(1) : version;
    }

    /**
     * Parses a semantic version string into [major, minor, patch]
     * Returns null if the version is invalid
     */
    private parseVersion(version: string): [number, number, number] | null {
        const normalized = this.normalizeVersion(version);
        
        // Match semantic version pattern: major.minor.patch
        const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)/);
        
        if (!match) {
            return null;
        }

        return [
            parseInt(match[1], 10),
            parseInt(match[2], 10),
            parseInt(match[3], 10)
        ];
    }

    /**
     * Fetches JSON data from a URL
     */
    private fetchJson(url: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const headers: Record<string, string> = {
                'User-Agent': 'vscode-groovy-extension'
            };

            // Add GitHub authentication if token is available
            if (process.env.GITHUB_TOKEN) {
                headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
            }

            const request = https.get(url, { headers }, (response) => {
                let data = '';

                response.on('data', (chunk) => {
                    data += chunk;
                });

                response.on('end', () => {
                    try {
                        const json = JSON.parse(data);

                        if (response.statusCode && response.statusCode >= 400) {
                            reject(new Error(`HTTP ${response.statusCode}: ${json.message || 'Request failed'}`));
                            return;
                        }

                        resolve(json);
                    } catch (error) {
                        reject(new Error(`Failed to parse JSON: ${(error as Error).message}`));
                    }
                });
            });

            request.on('error', (error) => reject(error));
            request.setTimeout(this.timeout, () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    /**
     * Fetches text content from a URL
     */
    private fetchText(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const headers: Record<string, string> = {
                'User-Agent': 'vscode-groovy-extension'
            };

            if (process.env.GITHUB_TOKEN) {
                headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
            }

            const request = https.get(url, { headers }, (response) => {
                let data = '';

                response.on('data', (chunk) => {
                    data += chunk;
                });

                response.on('end', () => resolve(data));
            });

            request.on('error', (error) => reject(error));
            request.setTimeout(this.timeout, () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    /**
     * Selects the appropriate JAR asset from release assets
     * Prefers linux-amd64/universal JAR
     */
    private selectJarAsset(assets: any[]): any | null {
        if (!assets || assets.length === 0) {
            return null;
        }

        // Prefer linux-amd64 JAR (universal)
        const preferred = assets.find(
            (a) => a.name.endsWith('.jar') && a.name.includes('linux-amd64')
        );

        if (preferred) {
            return preferred;
        }

        // Fallback to any JAR file
        return assets.find((a) => a.name.endsWith('.jar')) || null;
    }

    /**
     * Attempts to find a checksum for the given asset name from checksums.txt
     */
    private async fetchChecksumForAsset(assets: any[], assetName: string): Promise<string | null> {
        const checksumAsset = assets.find((a) => a.name === 'checksums.txt');
        
        if (!checksumAsset) {
            return null;
        }

        try {
            const content = await this.fetchText(checksumAsset.browser_download_url);
            const line = content
                .split('\n')
                .find((l) => l.trim().endsWith(` ${assetName}`));

            if (!line) {
                return null;
            }

            const [hash] = line.trim().split(/\s+/);
            return hash || null;
        } catch (error) {
            console.warn(`Warning: Unable to read checksums.txt: ${(error as Error).message}`);
            return null;
        }
    }
}
