
import * as vscode from 'vscode';
import { ILSPToolService } from './types';
import { ToolRegistry } from './ToolRegistry';

/**
 * Provides standard commands for AI agents (like Cursor) to invoke tools.
 */
export class CommandProvider implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];

    constructor(
        private readonly lspService: ILSPToolService,
        private readonly registry: ToolRegistry
    ) {
        this.registerCommands();
    }

    private registerCommands() {
        if (this.registry.isToolEnabled('groovy_find_symbol')) {
            this.disposables.push(vscode.commands.registerCommand('groovy.ai.find_symbol', async (args: { query: string }) => {
                return await this.lspService.findWorkspaceSymbol(args.query);
            }));
        }

        if (this.registry.isToolEnabled('groovy_get_references')) {
            this.disposables.push(vscode.commands.registerCommand('groovy.ai.get_references', async (args: { uri: string; line: number; character: number }) => {
                return await this.lspService.findReferences(args.uri, args.line, args.character);
            }));
        }

        if (this.registry.isToolEnabled('groovy_get_definition')) {
            this.disposables.push(vscode.commands.registerCommand('groovy.ai.get_definition', async (args: { uri: string; line: number; character: number }) => {
                return await this.lspService.getDefinition(args.uri, args.line, args.character);
            }));
        }
    }

    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}
