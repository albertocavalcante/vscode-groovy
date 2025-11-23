import * as vscode from 'vscode';
import { GroovyReplTerminal, ReplTerminalEvents } from './replTerminal';
import { ReplClient, SessionConfig } from './replClient';
import { logger } from '../../utils/logger';
import { getClient } from '../../server/client';

/**
 * REPL manager that coordinates terminal and LSP communication
 */
class ReplManager implements ReplTerminalEvents {
    private terminal: vscode.Terminal | undefined;
    private replTerminal: GroovyReplTerminal | undefined;
    private client: ReplClient;
    private sessionId: string | undefined;

    constructor() {
        this.client = new ReplClient(() => getClient());
    }

    /**
     * Start a new REPL session
     */
    async startRepl(config?: SessionConfig): Promise<void> {
        try {
            // Check if language client is available
            if (!this.client.isAvailable()) {
                vscode.window.showErrorMessage(
                    'Groovy Language Server is not connected. Please ensure the server is running.'
                );
                return;
            }

            // Close existing terminal if any
            if (this.terminal) {
                this.terminal.dispose();
            }

            // Create new REPL terminal
            this.replTerminal = new GroovyReplTerminal(this);

            // Create VSCode terminal
            this.terminal = vscode.window.createTerminal({
                name: 'Groovy REPL',
                pty: this.replTerminal.createPseudoTerminal(),
                iconPath: new vscode.ThemeIcon('play')
            });

            // Show the terminal
            this.terminal.show();

            // Create session on LSP
            const sessionResult = await this.client.createSession(config);
            this.sessionId = sessionResult.sessionId;
            this.replTerminal.setSessionId(this.sessionId);

            logger.info(`REPL started with session ID: ${this.sessionId}`);

            // Show status message
            vscode.window.showInformationMessage(
                `Groovy REPL started (Session: ${this.sessionId.substring(0, 8)}...)`
            );

        } catch (error) {
            const message = `Failed to start REPL: ${error instanceof Error ? error.message : 'Unknown error'}`;
            logger.error(message);
            vscode.window.showErrorMessage(message);
        }
    }

    /**
     * Send current line to REPL
     */
    async sendLineToRepl(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor found');
            return;
        }

        const document = editor.document;
        if (!this.isGroovyFile(document)) {
            vscode.window.showWarningMessage('Current file is not a Groovy file');
            return;
        }

        // Ensure REPL is running
        if (!this.terminal || !this.sessionId) {
            await this.startRepl();
            if (!this.sessionId) return;
        }

        const position = editor.selection.active;
        const line = document.lineAt(position.line);
        const code = line.text.trim();

        if (code) {
            this.terminal!.show();
            await this.evaluateInRepl(code);
        }
    }

    /**
     * Send selection to REPL
     */
    async sendSelectionToRepl(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor found');
            return;
        }

        const document = editor.document;
        if (!this.isGroovyFile(document)) {
            vscode.window.showWarningMessage('Current file is not a Groovy file');
            return;
        }

        // Ensure REPL is running
        if (!this.terminal || !this.sessionId) {
            await this.startRepl();
            if (!this.sessionId) return;
        }

        let code: string;
        if (editor.selection.isEmpty) {
            // No selection, send current line
            const line = document.lineAt(editor.selection.active.line);
            code = line.text.trim();
        } else {
            // Send selection
            code = document.getText(editor.selection);
        }

        if (code) {
            this.terminal!.show();
            await this.evaluateInRepl(code);
        }
    }

    /**
     * Send file to REPL
     */
    async sendFileToRepl(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor found');
            return;
        }

        const document = editor.document;
        if (!this.isGroovyFile(document)) {
            vscode.window.showWarningMessage('Current file is not a Groovy file');
            return;
        }

        // Ensure REPL is running
        if (!this.terminal || !this.sessionId) {
            await this.startRepl();
            if (!this.sessionId) return;
        }

        const code = document.getText();
        if (code.trim()) {
            this.terminal!.show();
            await this.evaluateInRepl(code);
        }
    }

    /**
     * Restart REPL
     */
    async restartRepl(): Promise<void> {
        if (this.sessionId) {
            try {
                await this.client.destroySession(this.sessionId);
            } catch (error) {
                logger.warn(`Failed to destroy existing session: ${error}`);
            }
        }

        await this.startRepl();
    }

    /**
     * Stop REPL
     */
    async stopRepl(): Promise<void> {
        if (this.sessionId) {
            try {
                await this.client.destroySession(this.sessionId);
                this.sessionId = undefined;
            } catch (error) {
                logger.warn(`Failed to destroy session: ${error}`);
            }
        }

        if (this.terminal) {
            this.terminal.dispose();
            this.terminal = undefined;
        }

        this.replTerminal = undefined;
        logger.info('REPL stopped');
    }

    /**
     * Clear REPL
     */
    async clearRepl(): Promise<void> {
        if (this.terminal && this.sessionId) {
            // The terminal will handle the clear command
            this.terminal.show();
        }
    }

    /**
     * Show REPL if it exists
     */
    showRepl(): void {
        if (this.terminal) {
            this.terminal.show();
        } else {
            vscode.window.showInformationMessage(
                'REPL is not running. Use "Groovy: Start REPL" to start it.'
            );
        }
    }

    /**
     * Get REPL status
     */
    getStatus(): { isRunning: boolean; sessionId?: string } {
        return {
            isRunning: !!this.terminal && !!this.sessionId,
            sessionId: this.sessionId
        };
    }

    // ReplTerminalEvents implementation

    /**
     * Handle code evaluation from terminal
     */
    async onEvaluate(code: string): Promise<void> {
        await this.evaluateInRepl(code);
    }

    /**
     * Handle completion requests from terminal (future enhancement)
     */
    async onComplete?(code: string, position: number): Promise<string[]> {
        if (!this.sessionId) return [];

        try {
            const result = await this.client.getCompletions(this.sessionId, code, position);
            return result.completions.map(c => c.label);
        } catch (error) {
            logger.warn(`Failed to get completions: ${error}`);
            return [];
        }
    }

    /**
     * Handle clear requests from terminal
     */
    async onClear?(): Promise<void> {
        // Additional clear logic if needed
    }

    /**
     * Handle restart requests from terminal
     */
    async onRestart?(): Promise<void> {
        if (this.sessionId) {
            try {
                const sessionResult = await this.client.createSession();
                this.sessionId = sessionResult.sessionId;
                this.replTerminal?.setSessionId(this.sessionId);
                logger.info(`REPL restarted with new session ID: ${this.sessionId}`);
            } catch (error) {
                logger.error(`Failed to restart REPL session: ${error}`);
                throw error;
            }
        }
    }

    // Private helper methods

    /**
     * Evaluate code in the REPL and display results
     */
    private async evaluateInRepl(code: string): Promise<void> {
        if (!this.sessionId || !this.replTerminal) {
            logger.error('REPL not properly initialized');
            return;
        }

        try {
            const result = await this.client.evaluate(this.sessionId, code, {
                captureOutput: true,
                includeBindings: false
            });

            if (result.success) {
                const formattedResult = this.client.formatResult(result);
                if (formattedResult && formattedResult !== '(no output)') {
                    this.replTerminal.writeResult(formattedResult, false);
                }

                // Show any side effect output
                if (result.sideEffects?.errorOutput) {
                    this.replTerminal.writeOutput(result.sideEffects.errorOutput);
                }
            } else {
                const errorMessage = this.client.formatResult(result);
                this.replTerminal.writeResult(errorMessage, true);
            }

        } catch (error) {
            const errorMessage = `Evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            this.replTerminal.writeResult(errorMessage, true);
            logger.error(errorMessage);
        }
    }

    /**
     * Check if a document is a Groovy file
     */
    private isGroovyFile(document: vscode.TextDocument): boolean {
        return document.languageId === 'groovy' || document.languageId === 'jenkinsfile';
    }
}

// Global REPL manager instance
let replManager: ReplManager | undefined;

/**
 * Get or create the REPL manager instance
 */
function getReplManager(): ReplManager {
    if (!replManager) {
        replManager = new ReplManager();
    }
    return replManager;
}

/**
 * Register all REPL-related commands
 */
export function registerReplCommands(context: vscode.ExtensionContext): void {
    const disposables: vscode.Disposable[] = [];

    // Start REPL command
    disposables.push(
        vscode.commands.registerCommand('groovy.repl.start', async () => {
            const manager = getReplManager();
            await manager.startRepl();
        })
    );

    // Send line to REPL command
    disposables.push(
        vscode.commands.registerCommand('groovy.repl.sendLine', async () => {
            const manager = getReplManager();
            await manager.sendLineToRepl();
        })
    );

    // Send selection to REPL command
    disposables.push(
        vscode.commands.registerCommand('groovy.repl.sendSelection', async () => {
            const manager = getReplManager();
            await manager.sendSelectionToRepl();
        })
    );

    // Send file to REPL command
    disposables.push(
        vscode.commands.registerCommand('groovy.repl.sendFile', async () => {
            const manager = getReplManager();
            await manager.sendFileToRepl();
        })
    );

    // Restart REPL command
    disposables.push(
        vscode.commands.registerCommand('groovy.repl.restart', async () => {
            const manager = getReplManager();
            await manager.restartRepl();
        })
    );

    // Stop REPL command
    disposables.push(
        vscode.commands.registerCommand('groovy.repl.stop', async () => {
            const manager = getReplManager();
            await manager.stopRepl();
        })
    );

    // Clear REPL command
    disposables.push(
        vscode.commands.registerCommand('groovy.repl.clear', async () => {
            const manager = getReplManager();
            await manager.clearRepl();
        })
    );

    // Show REPL command
    disposables.push(
        vscode.commands.registerCommand('groovy.repl.show', () => {
            const manager = getReplManager();
            manager.showRepl();
        })
    );

    // Add all disposables to context
    context.subscriptions.push(...disposables);

    logger.info('REPL commands registered');
}

/**
 * Get the current REPL status (for status bar)
 */
export function getReplStatus(): { isRunning: boolean; sessionId?: string } {
    if (!replManager) {
        return { isRunning: false };
    }
    return replManager.getStatus();
}

/**
 * Cleanup REPL resources on extension deactivation
 */
export async function deactivateRepl(): Promise<void> {
    if (replManager) {
        await replManager.stopRepl();
        replManager = undefined;
    }
}