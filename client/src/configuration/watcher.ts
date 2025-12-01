import { workspace, Disposable, window, ConfigurationChangeEvent } from 'vscode';
import {
    requiresServerRestart,
    canBeAppliedDynamically,
    affectsUpdateConfiguration
} from './settings';
import { restartClient, getClient } from '../server/client';
import { UpdateCheckerService } from '../features/update';

// Reference to the update checker service
let updateCheckerServiceRef: UpdateCheckerService | null = null;

/**
 * Sets the UpdateCheckerService reference for configuration handling
 */
export function setUpdateCheckerServiceRef(service: UpdateCheckerService): void {
    updateCheckerServiceRef = service;
}

/**
 * Sets up configuration change watchers
 */
export function setupConfigurationWatcher(): Disposable {
    return workspace.onDidChangeConfiguration(async (event) => {
        // Check if any groovy.* configuration changed
        if (!event.affectsConfiguration('groovy')) {
            return;
        }

        // Handle update configuration changes
        if (affectsUpdateConfiguration(event)) {
            await handleUpdateConfigurationChange(event);
        }

        // Handle settings that require a server restart
        if (requiresServerRestart(event)) {
            const answer = await window.showInformationMessage(
                'Groovy configuration changed. The language server needs to be restarted for changes to take effect.',
                'Restart Now',
                'Restart Later'
            );

            if (answer === 'Restart Now') {
                console.log('Configuration changed, restarting server...');
                await restartClient();
            }
            return;
        }

        // Handle settings that can be applied dynamically
        if (canBeAppliedDynamically(event)) {
            console.log('Configuration changed, notifying server...');
            const client = getClient();
            if (client) {
                // The LSP client automatically sends workspace/didChangeConfiguration
                // when configurationSection is set in client options
                // No action needed here - just log for debugging
                console.log('Server will be notified via workspace/didChangeConfiguration');
            }
        }
    });
}

/**
 * Handles update configuration changes
 */
async function handleUpdateConfigurationChange(event: ConfigurationChangeEvent): Promise<void> {
    if (!updateCheckerServiceRef) {
        return;
    }

    // Handle airgap mode toggle
    if (event.affectsConfiguration('groovy.update.airgapMode')) {
        const config = workspace.getConfiguration('groovy.update');
        const airgapMode = config.get<boolean>('airgapMode', false);
        
        console.log(`Airgap mode ${airgapMode ? 'enabled' : 'disabled'}`);
        
        // If airgap mode was disabled, trigger an update check
        if (!airgapMode) {
            console.log('Airgap mode disabled, triggering update check...');
            updateCheckerServiceRef.checkForUpdates().catch((error) => {
                console.error('Update check after airgap mode toggle failed:', error);
            });
        }
    }

    // Handle autoUpdate toggle
    if (event.affectsConfiguration('groovy.update.autoUpdate')) {
        const config = workspace.getConfiguration('groovy.update');
        const autoUpdate = config.get<boolean>('autoUpdate', false);
        
        console.log(`Auto-update ${autoUpdate ? 'enabled' : 'disabled'}`);
    }

    // Handle checkInterval change - service will pick up new value on next check
    if (event.affectsConfiguration('groovy.update.checkInterval')) {
        console.log('Update check interval changed');
    }
}