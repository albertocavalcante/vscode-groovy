/**
 * Document formatting functionality for Groovy files
 */

import * as vscode from 'vscode';
import { getClient } from '../../server/client';
import { getConfiguration } from '../../configuration/settings';
import { logger } from '../../utils/logger';

/**
 * Formats the entire document
 */
export async function formatDocument(): Promise<void> {
    const config = getConfiguration();
    if (!config.formatEnable) {
        vscode.window.showInformationMessage('Groovy formatting is disabled in settings');
        return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor found');
        return;
    }

    const document = editor.document;
    if (document.languageId !== 'groovy' && document.languageId !== 'jenkinsfile') {
        vscode.window.showWarningMessage('Active document is not a Groovy file');
        return;
    }

    if (!isFormattingAvailable()) {
        vscode.window.showErrorMessage('Groovy formatting is not available. Please ensure the Language Server is running.');
        return;
    }

    try {
        await vscode.commands.executeCommand('editor.action.formatDocument');
        logger.info('Document formatted successfully');
    } catch (error) {
        const message = `Failed to format document: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(message);
        vscode.window.showErrorMessage(message);
    }
}

/**
 * Formats the current selection or the entire document if no selection
 */
export async function formatSelection(): Promise<void> {
    const config = getConfiguration();
    if (!config.formatEnable) {
        vscode.window.showInformationMessage('Groovy formatting is disabled in settings');
        return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor found');
        return;
    }

    const document = editor.document;
    if (document.languageId !== 'groovy' && document.languageId !== 'jenkinsfile') {
        vscode.window.showWarningMessage('Active document is not a Groovy file');
        return;
    }

    if (!isFormattingAvailable()) {
        vscode.window.showErrorMessage('Groovy formatting is not available. Please ensure the Language Server is running.');
        return;
    }

    try {
        if (editor.selection.isEmpty) {
            // If no selection, format the entire document
            await vscode.commands.executeCommand('editor.action.formatDocument');
            logger.info('Document formatted successfully');
        } else {
            // Format the selected range
            await vscode.commands.executeCommand('editor.action.formatSelection');
            logger.info('Selection formatted successfully');
        }
    } catch (error) {
        const message = `Failed to format selection: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(message);
        vscode.window.showErrorMessage(message);
    }
}

/**
 * Checks if formatting is available (LSP server supports it)
 */
export function isFormattingAvailable(): boolean {
    const client = getClient();
    if (!client) {
        return false;
    }

    // Check if the server supports document formatting
    const capabilities = client.initializeResult?.capabilities;
    return !!(capabilities?.documentFormattingProvider || capabilities?.documentRangeFormattingProvider);
}

/**
 * Format on save handler
 */
async function onWillSaveDocument(event: vscode.TextDocumentWillSaveEvent): Promise<void> {
    const config = getConfiguration();
    if (!config.formatEnable || !config.formatOnSave) {
        return;
    }

    const document = event.document;
    if (document.languageId !== 'groovy' && document.languageId !== 'jenkinsfile') {
        return;
    }

    if (!isFormattingAvailable()) {
        return;
    }

    try {
        // Format the document before saving
        const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
            'vscode.executeFormatDocumentProvider',
            document.uri,
            {
                insertSpaces: true,
                tabSize: 4
            }
        );

        if (edits && edits.length > 0) {
            event.waitUntil(
                vscode.workspace.applyEdit(
                    edits.reduce((workspaceEdit, edit) => {
                        workspaceEdit.set(document.uri, [edit]);
                        return workspaceEdit;
                    }, new vscode.WorkspaceEdit())
                )
            );
            logger.info('Document formatted on save');
        }
    } catch (error) {
        logger.error(`Failed to format document on save: ${error}`);
    }
}

/**
 * Registers formatting-related commands
 */
export function registerFormattingCommands(context: vscode.ExtensionContext): void {
    // Register format document command
    const formatDocCommand = vscode.commands.registerCommand('groovy.format.document', formatDocument);
    context.subscriptions.push(formatDocCommand);

    // Register format selection command
    const formatSelectionCommand = vscode.commands.registerCommand('groovy.format.selection', formatSelection);
    context.subscriptions.push(formatSelectionCommand);

    // Register format on save listener
    const onWillSaveListener = vscode.workspace.onWillSaveTextDocument(onWillSaveDocument);
    context.subscriptions.push(onWillSaveListener);

    logger.info('Formatting commands and listeners registered');
}