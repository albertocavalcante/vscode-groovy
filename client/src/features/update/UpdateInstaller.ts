import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as crypto from 'crypto';
import type { ReleaseInfo } from './VersionChecker';

/**
 * Result of an installation attempt
 */
export interface InstallResult {
    success: boolean;
    version: string;
    error?: string;
}

/**
 * Handles downloading and installing new LSP versions
 */
export class UpdateInstaller {
    private readonly serverDir: string;
    private readonly jarPath: string;
    private readonly versionFile: string;
    private readonly timeout = 60000; // 60 seconds for downloads

    constructor(extensionPath: string) {
        this.serverDir = path.join(extensionPath, 'server');
        this.jarPath = path.join(this.serverDir, 'groovy-lsp.jar');
        this.versionFile = path.join(this.serverDir, '.groovy-lsp-version');
    }

    /**
     * Downloads and installs a specific release
     */
    async installRelease(release: ReleaseInfo): Promise<InstallResult> {
        try {
            // Ensure server directory exists
            this.ensureServerDirectory();

            // Download the JAR file
            await this.downloadFile(release.downloadUrl, this.jarPath);

            // Verify checksum if available
            if (release.checksum) {
                try {
                    await this.verifyChecksum(this.jarPath, release.checksum);
                } catch (checksumError) {
                    // Clean up corrupted download
                    this.cleanupFile(this.jarPath);
                    throw checksumError;
                }
            }

            // Write version marker
            this.writeInstalledVersion(release.tagName);

            return {
                success: true,
                version: release.tagName
            };
        } catch (error) {
            return {
                success: false,
                version: release.tagName,
                error: (error as Error).message
            };
        }
    }

    /**
     * Ensures the server directory exists
     */
    private ensureServerDirectory(): void {
        if (!fs.existsSync(this.serverDir)) {
            fs.mkdirSync(this.serverDir, { recursive: true });
        }
    }

    /**
     * Gets the currently installed version
     */
    getInstalledVersion(): string | null {
        try {
            if (!fs.existsSync(this.versionFile)) {
                return null;
            }

            const content = fs.readFileSync(this.versionFile, 'utf8').trim();
            return content || null;
        } catch (error) {
            console.warn(`Warning: Could not read version file: ${(error as Error).message}`);
            return null;
        }
    }

    /**
     * Downloads a file from URL to local path
     */
    private downloadFile(url: string, filePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const handleRequest = (requestUrl: string) => {
                const request = https.get(requestUrl, (response) => {
                    // Handle redirects
                    if (
                        response.statusCode &&
                        response.statusCode >= 300 &&
                        response.statusCode < 400 &&
                        response.headers.location
                    ) {
                        return handleRequest(response.headers.location);
                    }

                    if (response.statusCode !== 200) {
                        reject(
                            new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`)
                        );
                        return;
                    }

                    // Create file stream only when we have a successful response
                    const file = fs.createWriteStream(filePath);

                    file.on('error', (error) => {
                        this.cleanupFile(filePath);
                        reject(error);
                    });

                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });

                    response.pipe(file);
                });

                request.on('error', (error) => {
                    this.cleanupFile(filePath);
                    reject(error);
                });

                request.setTimeout(this.timeout, () => {
                    request.destroy();
                    reject(new Error('Download timeout'));
                });
            };

            handleRequest(url);
        });
    }

    /**
     * Computes SHA-256 for a file path (streaming to avoid large buffers)
     */
    private sha256File(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = fs.createReadStream(filePath);
            
            stream.on('data', (chunk) => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }

    /**
     * Validates the checksum of the JAR
     */
    private async verifyChecksum(filePath: string, expectedHash: string): Promise<void> {
        const actual = await this.sha256File(filePath);
        
        if (actual !== expectedHash) {
            throw new Error(
                `Checksum mismatch for ${filePath}. Expected ${expectedHash} but got ${actual}`
            );
        }
    }

    /**
     * Writes version marker for the installed JAR
     */
    private writeInstalledVersion(versionTag: string): void {
        fs.writeFileSync(this.versionFile, `${versionTag}\n`, 'utf8');
    }

    /**
     * Safely removes a file, ignoring errors
     */
    private cleanupFile(filePath: string): void {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            console.warn(`Warning: Failed to remove file ${filePath}: ${(error as Error).message}`);
        }
    }
}
