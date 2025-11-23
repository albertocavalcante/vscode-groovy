import * as vscode from 'vscode';
import { getReplStatus } from './replCommands';
import { logger } from '../../utils/logger';

/**
 * REPL status bar manager
 */
export class ReplStatusBar {
    private statusBarItem: vscode.StatusBarItem;
    private updateInterval: NodeJS.Timeout | undefined;

    constructor() {
        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100 // Priority - appears towards the right
        );

        // Set up the status bar item
        this.statusBarItem.tooltip = 'Groovy REPL Status';
        this.statusBarItem.command = 'groovy.repl.toggleOrStart';

        // Start periodic updates
        this.startPeriodicUpdates();

        // Initial update
        this.updateStatus();

        // Show the status bar item
        this.statusBarItem.show();
    }

    /**
     * Start periodic status updates
     */
    private startPeriodicUpdates(): void {
        // Update status every 2 seconds
        this.updateInterval = setInterval(() => {
            this.updateStatus();
        }, 2000);
    }

    /**
     * Update the status bar item based on current REPL status
     */
    private updateStatus(): void {
        try {
            const status = getReplStatus();

            if (status.isRunning) {
                // REPL is running
                const sessionShort = status.sessionId?.substring(0, 8) || 'unknown';
                this.statusBarItem.text = `$(terminal) REPL (${sessionShort})`;
                this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.activeBackground');
                this.statusBarItem.tooltip = `Groovy REPL is running (Session: ${sessionShort})\nClick to show REPL terminal`;
                this.statusBarItem.command = 'groovy.repl.show';
            } else {
                // REPL is not running
                this.statusBarItem.text = '$(terminal) REPL';
                this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.foreground');
                this.statusBarItem.tooltip = 'Groovy REPL is not running\nClick to start REPL';
                this.statusBarItem.command = 'groovy.repl.start';
            }
        } catch (error) {
            logger.warn(`Failed to update REPL status: ${error}`);
            // Set fallback status
            this.statusBarItem.text = '$(terminal) REPL';
            this.statusBarItem.color = undefined;
            this.statusBarItem.tooltip = 'Groovy REPL (status unknown)';
            this.statusBarItem.command = 'groovy.repl.start';
        }
    }

    /**
     * Force an immediate status update
     */
    public forceUpdate(): void {
        this.updateStatus();
    }

    /**
     * Show a temporary status message
     */
    public showTemporaryMessage(message: string, duration = 3000): void {
        const originalText = this.statusBarItem.text;
        const originalTooltip = this.statusBarItem.tooltip;

        this.statusBarItem.text = message;
        this.statusBarItem.tooltip = message;

        setTimeout(() => {
            this.statusBarItem.text = originalText;
            this.statusBarItem.tooltip = originalTooltip;
        }, duration);
    }

    /**
     * Dispose of the status bar item and cleanup
     */
    public dispose(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = undefined;
        }

        this.statusBarItem.dispose();
    }
}

// Global status bar instance
let statusBar: ReplStatusBar | undefined;

/**
 * Initialize the REPL status bar
 */
export function initializeReplStatusBar(context: vscode.ExtensionContext): void {
    if (statusBar) {
        statusBar.dispose();
    }

    statusBar = new ReplStatusBar();
    context.subscriptions.push(statusBar);

    // Register the toggle/start command
    const toggleCommand = vscode.commands.registerCommand('groovy.repl.toggleOrStart', async () => {
        const status = getReplStatus();
        if (status.isRunning) {
            // REPL is running, show it
            await vscode.commands.executeCommand('groovy.repl.show');
        } else {
            // REPL is not running, start it
            await vscode.commands.executeCommand('groovy.repl.start');
        }
    });

    context.subscriptions.push(toggleCommand);
    logger.info('REPL status bar initialized');
}

/**
 * Get the current status bar instance
 */
export function getReplStatusBar(): ReplStatusBar | undefined {
    return statusBar;
}

/**
 * Update the status bar immediately
 */
export function updateReplStatusBar(): void {
    if (statusBar) {
        statusBar.forceUpdate();
    }
}

/**
 * Show a temporary message in the status bar
 */
export function showStatusMessage(message: string, duration?: number): void {
    if (statusBar) {
        statusBar.showTemporaryMessage(message, duration);
    }
}

/**
 * Cleanup status bar resources
 */
export function deactivateReplStatusBar(): void {
    if (statusBar) {
        statusBar.dispose();
        statusBar = undefined;
    }
}