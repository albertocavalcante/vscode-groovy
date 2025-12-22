
import * as vscode from 'vscode';
import { ILSPToolService, AISymbolInfo, AILocation } from './types';
import { ToolRegistry } from './ToolRegistry';

/**
 * Provides tools to the VS Code Language Model API.
 */
export class LMToolProvider implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];

    constructor(
        private readonly lspService: ILSPToolService,
        private readonly registry: ToolRegistry
    ) {
        this.registerTools();
    }

    private registerTools() {
        if (this.registry.isToolEnabled('groovy_find_symbol')) {
            this.disposables.push(vscode.lm.registerTool('groovy_find_symbol', {
                invoke: async (options: vscode.LanguageModelToolInvocationOptions<any>) => {
                    const params = (options as any).parameters as { query: string };
                    const symbols = await this.lspService.findWorkspaceSymbol(params.query);
                    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(JSON.stringify(symbols, null, 2))]);
                }
            }));
        }

        if (this.registry.isToolEnabled('groovy_get_references')) {
            this.disposables.push(vscode.lm.registerTool('groovy_get_references', {
                invoke: async (options: vscode.LanguageModelToolInvocationOptions<any>) => {
                    const params = (options as any).parameters as { uri: string; line: number; character: number };
                    const refs = await this.lspService.findReferences(params.uri, params.line, params.character);
                    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(JSON.stringify(refs, null, 2))]);
                }
            }));
        }

        if (this.registry.isToolEnabled('groovy_get_definition')) {
            this.disposables.push(vscode.lm.registerTool('groovy_get_definition', {
                invoke: async (options: vscode.LanguageModelToolInvocationOptions<any>) => {
                    const params = (options as any).parameters as { uri: string; line: number; character: number };
                    const def = await this.lspService.getDefinition(params.uri, params.line, params.character);
                    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(JSON.stringify(def, null, 2))]);
                }
            }));
        }
    }

    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}
