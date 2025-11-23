import * as vscode from 'vscode';
import { registerReplCommands, getReplStatus, deactivateRepl } from './replCommands';
import { initializeReplStatusBar, updateReplStatusBar, showStatusMessage, deactivateReplStatusBar } from './replStatusBar';

/**
 * Groovy REPL Integration for VSCode
 *
 * This module provides a comprehensive REPL (Read-Eval-Print Loop) experience
 * for Groovy development in VSCode, using the Groovy Language Server.
 */

// Export main REPL functionality
export { registerReplCommands, getReplStatus, deactivateRepl };
export { initializeReplStatusBar, updateReplStatusBar, showStatusMessage, deactivateReplStatusBar };

// Export client interfaces for external use
export type {
    SessionConfig,
    EvaluationResult,
    SessionCreateResult,
    CompletionResult,
    VariableInspectionResult,
    HistoryEntry,
    HistoryResult
} from './replClient';

export { ReplClient } from './replClient';

// Export terminal interfaces for customization
export type { ReplTerminalEvents } from './replTerminal';
export { GroovyReplTerminal, Colors } from './replTerminal';

/**
 * Initialize all REPL features
 * Call this from the main extension activation
 */
export function initializeRepl(context: vscode.ExtensionContext): void {
    // Register REPL commands
    registerReplCommands(context);

    // Initialize status bar
    initializeReplStatusBar(context);
}

/**
 * Cleanup all REPL features
 * Call this from the main extension deactivation
 */
export async function cleanupRepl(): Promise<void> {
    await deactivateRepl();
    deactivateReplStatusBar();
}