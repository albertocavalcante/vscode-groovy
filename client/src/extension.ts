/**
 * VSCode Groovy Language Extension
 * Modern, modular architecture with domain-driven design
 */

import { ExtensionContext, window } from 'vscode';
import { initializeClient, startClient, stopClient } from './server/client';
import { registerStatusBarItem } from './ui/statusBar';
import { registerCommands, setUpdateCheckerService } from './commands';
import { setupConfigurationWatcher, setUpdateCheckerServiceRef, setOutputChannel } from './configuration/watcher';
import { registerFormatting } from './features/formatting/formatter';
import { replService } from './features/repl';
import { registerGradleFeatures } from './features/gradle';
import { UpdateCheckerService } from './features/update';

/**
 * Activates the extension
 */
export async function activate(context: ExtensionContext) {
    console.log('Groovy Language Extension is activating...');

    try {
        // Create output channel for logging
        const outputChannel = window.createOutputChannel('Groovy');
        context.subscriptions.push(outputChannel);
        setOutputChannel(outputChannel);

        // Initialize the LSP client with context
        initializeClient(context);

        // Register status bar indicator
        const statusBarDisposable = registerStatusBarItem();
        context.subscriptions.push(statusBarDisposable);

        // Initialize update checker service
        const updateCheckerService = new UpdateCheckerService();
        updateCheckerService.initialize(context);
        setUpdateCheckerService(updateCheckerService);
        setUpdateCheckerServiceRef(updateCheckerService);
        context.subscriptions.push({
            dispose: () => updateCheckerService.dispose()
        });

        // Register commands
        registerCommands(context);

        // Setup configuration watchers
        const configWatcher = setupConfigurationWatcher();
        context.subscriptions.push(configWatcher);

        // Initialize REPL
        replService.initialize(context);

        // Start the Language Server
        await startClient();

        // Register features that depend on the client
        registerFormatting(context);
        registerGradleFeatures(context);

        console.log('Groovy Language Extension activated successfully');

    } catch (error) {
        const message = `Error activating Groovy Language Extension: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(message);
        // Don't show error message to user during activation, as it might be transient
        // The individual components will show their own error messages as needed
    }
}

/**
 * Deactivates the extension
 */
export async function deactivate(): Promise<void> {
    console.log('Deactivating Groovy Language Extension...');

    try {
        await stopClient();
        console.log('Groovy Language Extension deactivated successfully');
    } catch (error) {
        console.error('Error during deactivation:', error);
    }
}