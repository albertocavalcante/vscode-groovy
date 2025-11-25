import { workspace, Disposable, ConfigurationChangeEvent } from 'vscode';
import { affectsJavaConfiguration } from './settings';
import { restartClient } from '../server/client';

let sharedLibraryRefreshCallback: (() => Promise<void>) | undefined;

/**
 * Registers a callback to refresh shared libraries
 */
export function registerSharedLibraryRefreshCallback(callback: () => Promise<void>): void {
    sharedLibraryRefreshCallback = callback;
}

/**
 * Checks if a configuration change affects Jenkins shared libraries
 */
function affectsJenkinsConfiguration(event: ConfigurationChangeEvent): boolean {
    return event.affectsConfiguration('jenkins.sharedLibraries');
}

/**
 * Sets up configuration change watchers
 */
export function setupConfigurationWatcher(): Disposable {
    return workspace.onDidChangeConfiguration(async (event) => {
        // Restart server if Java configuration changed
        if (affectsJavaConfiguration(event)) {
            console.log('Java configuration changed, restarting server...');
            await restartClient();
        }

        // Refresh shared libraries if configuration changed
        if (affectsJenkinsConfiguration(event)) {
            console.log('Jenkins shared libraries configuration changed, refreshing...');
            if (sharedLibraryRefreshCallback) {
                await sharedLibraryRefreshCallback();
            }
        }

        // Add other configuration change handlers here as needed
    });
}