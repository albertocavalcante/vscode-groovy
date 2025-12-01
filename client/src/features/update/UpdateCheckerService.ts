import * as vscode from 'vscode';
import { VersionChecker, ReleaseInfo } from './VersionChecker';
import { VersionCache } from './VersionCache';
import { UpdateNotifier } from './UpdateNotifier';
import { UpdateInstaller } from './UpdateInstaller';
import { getUpdateConfiguration } from '../../configuration/settings';

/**
 * Result of an update check operation
 */
export interface UpdateCheckResult {
    status: 'up-to-date' | 'update-available' | 'skipped' | 'error';
    installedVersion: string | null;
    latestVersion: string | null;
    releaseUrl: string | null;
    error?: string;
}

/**
 * Version information for display
 */
export interface VersionInfo {
    installedVersion: string | null;
    latestVersion: string | null;
    isUpdateAvailable: boolean;
}

/**
 * Main orchestrator for LSP update checking and installation
 * Coordinates VersionChecker, VersionCache, UpdateNotifier, and UpdateInstaller
 */
export class UpdateCheckerService {
    private context: vscode.ExtensionContext | null = null;
    private versionChecker: VersionChecker;
    private versionCache: VersionCache | null = null;
    private updateNotifier: UpdateNotifier;
    private updateInstaller: UpdateInstaller | null = null;
    private checkTimer: NodeJS.Timeout | null = null;
    private disposed = false;

    constructor() {
        this.versionChecker = new VersionChecker();
        this.updateNotifier = new UpdateNotifier();
    }

    /**
     * Initializes the update checker with extension context
     */
    initialize(context: vscode.ExtensionContext): void {
        if (this.disposed) {
            throw new Error('UpdateCheckerService has been disposed');
        }

        this.context = context;
        
        // Initialize cache with configured interval
        const config = getUpdateConfiguration();
        this.versionCache = new VersionCache(context.globalState, config.checkInterval);
        
        // Initialize installer with extension path
        this.updateInstaller = new UpdateInstaller(context.extensionPath);

        // Schedule background checks if enabled
        if (config.checkOnStartup) {
            // Perform initial check after a short delay to not block activation
            setTimeout(() => {
                this.checkForUpdates().catch((error) => {
                    console.error('Initial update check failed:', error);
                });
            }, 5000); // 5 second delay
        }

        // Schedule periodic checks
        this.scheduleBackgroundChecks();
    }

    /**
     * Performs an update check (respects airgap mode and cache)
     * @param force - If true, bypasses cache and performs immediate check
     */
    async checkForUpdates(force: boolean = false): Promise<UpdateCheckResult> {
        if (this.disposed) {
            return {
                status: 'error',
                installedVersion: null,
                latestVersion: null,
                releaseUrl: null,
                error: 'Service has been disposed'
            };
        }

        if (!this.context || !this.versionCache || !this.updateInstaller) {
            return {
                status: 'error',
                installedVersion: null,
                latestVersion: null,
                releaseUrl: null,
                error: 'Service not initialized'
            };
        }

        const config = getUpdateConfiguration();

        // Check airgap mode (unless forced)
        if (!force && config.airgapMode) {
            return {
                status: 'skipped',
                installedVersion: this.updateInstaller.getInstalledVersion(),
                latestVersion: null,
                releaseUrl: null
            };
        }

        // Get installed version
        const installedVersion = this.updateInstaller.getInstalledVersion();

        // Check if installed version is valid for comparison
        if (!installedVersion || !this.versionChecker.isValidVersion(installedVersion)) {
            return {
                status: 'skipped',
                installedVersion,
                latestVersion: null,
                releaseUrl: null
            };
        }

        // Try to use cached release info (unless forced)
        let latestRelease: ReleaseInfo | null = null;
        
        if (!force) {
            const cached = this.versionCache.getCachedRelease();
            if (cached) {
                latestRelease = cached.release;
            }
        }

        // Fetch latest release if not cached
        if (!latestRelease) {
            latestRelease = await this.versionChecker.getLatestRelease();
            
            if (!latestRelease) {
                return {
                    status: 'error',
                    installedVersion,
                    latestVersion: null,
                    releaseUrl: null,
                    error: 'Failed to fetch latest release from GitHub'
                };
            }

            // Cache the result
            await this.versionCache.setCachedRelease(latestRelease);
        }

        // Compare versions
        const comparison = this.versionChecker.compareVersions(
            latestRelease.version,
            installedVersion
        );

        if (comparison <= 0) {
            // Up to date or latest is older
            if (force) {
                await this.updateNotifier.showUpToDateNotification(installedVersion);
            }
            
            return {
                status: 'up-to-date',
                installedVersion,
                latestVersion: latestRelease.version,
                releaseUrl: latestRelease.releaseUrl
            };
        }

        // Update available
        const result: UpdateCheckResult = {
            status: 'update-available',
            installedVersion,
            latestVersion: latestRelease.version,
            releaseUrl: latestRelease.releaseUrl
        };

        // Handle auto-update
        if (config.autoUpdate) {
            await this.performAutoUpdate(latestRelease);
        } else {
            // Show notification and handle user action
            await this.handleUpdateNotification(installedVersion, latestRelease);
        }

        return result;
    }

    /**
     * Gets version information for display
     * @returns Version information including installed and latest versions
     */
    async getVersionInfo(): Promise<VersionInfo> {
        if (!this.updateInstaller || !this.versionCache) {
            return {
                installedVersion: null,
                latestVersion: null,
                isUpdateAvailable: false
            };
        }

        const installedVersion = this.updateInstaller.getInstalledVersion();
        
        // Try to get latest version from cache
        const cached = this.versionCache.getCachedRelease();
        const latestVersion = cached?.release.version || null;
        
        // Determine if update is available
        let isUpdateAvailable = false;
        if (installedVersion && latestVersion && this.versionChecker.isValidVersion(installedVersion)) {
            const comparison = this.versionChecker.compareVersions(latestVersion, installedVersion);
            isUpdateAvailable = comparison > 0;
        }

        return {
            installedVersion,
            latestVersion,
            isUpdateAvailable
        };
    }

    /**
     * Disposes resources and cancels pending checks
     */
    dispose(): void {
        if (this.disposed) {
            return;
        }

        this.disposed = true;

        // Cancel scheduled checks
        if (this.checkTimer) {
            clearTimeout(this.checkTimer);
            this.checkTimer = null;
        }

        // Clear references
        this.context = null;
        this.versionCache = null;
        this.updateInstaller = null;
    }

    /**
     * Schedules background update checks based on configuration
     */
    private scheduleBackgroundChecks(): void {
        if (this.disposed || !this.context) {
            return;
        }

        const config = getUpdateConfiguration();
        
        // Cancel existing timer
        if (this.checkTimer) {
            clearTimeout(this.checkTimer);
        }

        // Schedule next check
        const intervalMs = config.checkInterval * 60 * 60 * 1000; // Convert hours to ms
        
        this.checkTimer = setTimeout(() => {
            this.checkForUpdates().catch((error) => {
                console.error('Background update check failed:', error);
            });
            
            // Reschedule
            this.scheduleBackgroundChecks();
        }, intervalMs);
    }

    /**
     * Performs automatic update installation
     */
    private async performAutoUpdate(release: ReleaseInfo): Promise<void> {
        const result = await this.updateInstaller!.installRelease(release);

        if (result.success) {
            await this.updateNotifier.showAutoUpdateNotification(result.version);
        } else {
            await this.updateNotifier.showErrorNotification(
                result.error || 'Unknown error during installation'
            );
        }
    }

    /**
     * Shows update notification and handles user action
     */
    private async handleUpdateNotification(
        currentVersion: string,
        release: ReleaseInfo
    ): Promise<void> {
        const action = await this.updateNotifier.showUpdateNotification(
            currentVersion,
            release.version,
            release.releaseUrl
        );

        switch (action) {
            case 'always-update':
                // Enable auto-update in settings
                await this.enableAutoUpdate();
                // Fall through to install
            case 'update-once':
                await this.performManualUpdate(release);
                break;
            case 'release-notes':
                // User opened release notes, do nothing else
                break;
            case 'dismissed':
                // User dismissed, do nothing
                break;
        }
    }

    /**
     * Performs manual update installation
     */
    private async performManualUpdate(release: ReleaseInfo): Promise<void> {
        const result = await this.updateInstaller!.installRelease(release);

        if (result.success) {
            const restart = 'Restart Server';
            const selection = await vscode.window.showInformationMessage(
                `Groovy LSP ${result.version} has been installed. Restart the language server to use the new version.`,
                restart
            );

            if (selection === restart) {
                await vscode.commands.executeCommand('groovy.server.restart');
            }
        } else {
            await this.updateNotifier.showErrorNotification(
                result.error || 'Unknown error during installation'
            );
        }
    }

    /**
     * Enables auto-update in configuration
     */
    private async enableAutoUpdate(): Promise<void> {
        const config = vscode.workspace.getConfiguration('groovy.update');
        await config.update('autoUpdate', true, vscode.ConfigurationTarget.Global);
    }
}
