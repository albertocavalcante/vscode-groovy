import { ExtensionContext, commands, Disposable, window } from 'vscode';
import { restartClient } from '../server/client';
import { UpdateCheckerService } from '../features/update';

// Singleton instance of UpdateCheckerService
let updateCheckerService: UpdateCheckerService | null = null;

/**
 * Sets the UpdateCheckerService instance for command handlers
 */
export function setUpdateCheckerService(service: UpdateCheckerService): void {
    updateCheckerService = service;
}

/**
 * Registers all extension commands
 */
export function registerCommands(context: ExtensionContext): Disposable[] {
    const disposables: Disposable[] = [];

    // Register restart server command
    const restartServerCommand = commands.registerCommand('groovy.restartServer', async () => {
        await restartClient();
    });
    disposables.push(restartServerCommand);

    // Register show version command
    const showVersionCommand = commands.registerCommand('groovy.showVersion', async () => {
        if (!updateCheckerService) {
            window.showErrorMessage('Update checker service is not initialized');
            return;
        }

        try {
            const versionInfo = await updateCheckerService.getVersionInfo();
            
            let message = `Installed: ${versionInfo.installedVersion || 'Unknown'}`;
            
            if (versionInfo.latestVersion) {
                message += `\nLatest: ${versionInfo.latestVersion}`;
                
                if (versionInfo.isUpdateAvailable) {
                    message += ' (update available)';
                }
            }

            window.showInformationMessage(message, 'OK');
        } catch (error) {
            console.error('Failed to get version information:', error);
            window.showErrorMessage(
                `Failed to get version information: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    });
    disposables.push(showVersionCommand);

    // Register update check command
    const updateCheckCommand = commands.registerCommand('groovy.update.check', async () => {
        if (!updateCheckerService) {
            window.showErrorMessage('Update checker service is not initialized');
            return;
        }

        try {
            // Force check bypasses cache and airgap mode
            await updateCheckerService.checkForUpdates(true);
        } catch (error) {
            console.error('Failed to check for updates:', error);
            window.showErrorMessage(
                `Failed to check for updates: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    });
    disposables.push(updateCheckCommand);

    // Add all disposables to context subscriptions
    context.subscriptions.push(...disposables);

    return disposables;
}