import * as vscode from 'vscode';

export type UpdateAction = 'always-update' | 'update-once' | 'release-notes' | 'dismissed';

/**
 * Manages VS Code notifications and user interactions for LSP updates
 */
export class UpdateNotifier {
    /**
     * Shows update available notification with action buttons
     * @param currentVersion The currently installed version
     * @param newVersion The new version available
     * @param releaseUrl The URL to the GitHub release page
     * @returns The action selected by the user
     */
    async showUpdateNotification(
        currentVersion: string,
        newVersion: string,
        releaseUrl: string
    ): Promise<UpdateAction> {
        const message = `Groovy LSP ${newVersion} is available (current: ${currentVersion})`;
        const alwaysUpdate = 'Always Update';
        const updateOnce = 'Update Once';
        const releaseNotes = 'Release Notes';

        const selection = await vscode.window.showInformationMessage(
            message,
            alwaysUpdate,
            updateOnce,
            releaseNotes
        );

        switch (selection) {
            case alwaysUpdate:
                return 'always-update';
            case updateOnce:
                return 'update-once';
            case releaseNotes:
                await vscode.env.openExternal(vscode.Uri.parse(releaseUrl));
                return 'release-notes';
            default:
                return 'dismissed';
        }
    }

    /**
     * Shows notification that an update was auto-installed
     * @param version The version that was installed
     */
    async showAutoUpdateNotification(version: string): Promise<void> {
        const message = `Groovy LSP has been automatically updated to ${version}. Restart the language server to use the new version.`;
        const restart = 'Restart Server';

        const selection = await vscode.window.showInformationMessage(message, restart);

        if (selection === restart) {
            await vscode.commands.executeCommand('groovy.server.restart');
        }
    }

    /**
     * Shows error notification for failed updates
     * @param error The error message to display
     */
    async showErrorNotification(error: string): Promise<void> {
        const message = `Failed to update Groovy LSP: ${error}`;
        await vscode.window.showErrorMessage(message);
    }

    /**
     * Shows "up to date" confirmation for manual checks
     * @param version The current version
     */
    async showUpToDateNotification(version: string): Promise<void> {
        const message = `Groovy LSP is up to date (${version})`;
        await vscode.window.showInformationMessage(message);
    }
}
