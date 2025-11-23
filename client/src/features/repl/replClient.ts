import { LanguageClient } from 'vscode-languageclient/node';
import { logger } from '../../utils/logger';

/**
 * Session configuration for REPL
 */
export interface SessionConfig {
    sessionId?: string;
    contextName?: string;
    imports?: string[];
    configuration?: {
        executionTimeout?: number;
        maxMemory?: string;
        sandboxing?: boolean;
        historySize?: number;
        enableMetaClassModifications?: boolean;
        allowedPackages?: string[];
        disallowedMethods?: string[];
    };
}

/**
 * Evaluation result from REPL
 */
export interface EvaluationResult {
    success: boolean;
    value?: any;
    type?: string;
    output?: string;
    duration?: number;
    bindings?: any;
    diagnostics?: any[];
    sideEffects?: {
        printOutput?: string;
        errorOutput?: string;
        imports?: string[];
        classesLoaded?: string[];
        systemPropertyChanges?: Record<string, string>;
    };
    error?: {
        message: string;
        type: string;
        diagnostics?: any[];
    };
}

/**
 * Session creation result
 */
export interface SessionCreateResult {
    sessionId: string;
    contextName: string;
    availableContexts: string[];
    configuration: any;
    initialBindings: any[];
}

/**
 * Completion result
 */
export interface CompletionResult {
    completions: Array<{
        label: string;
        kind: number;
        detail: string;
        documentation?: string;
    }>;
    bindingCompletions?: Array<{
        name: string;
        type: string;
        kind: string;
        documentation?: string;
        signature?: string;
    }>;
}

/**
 * Variable inspection result
 */
export interface VariableInspectionResult {
    variable: {
        name: string;
        value: string;
        type: string;
        isNull: boolean;
        hierarchy: string[];
    };
    methods?: Array<{
        name: string;
        signature: string;
        returnType: string;
        isStatic: boolean;
        visibility: string;
    }>;
    properties?: Array<{
        name: string;
        type: string;
        value?: string;
    }>;
    metaClass?: any;
}

/**
 * History entry
 */
export interface HistoryEntry {
    id: number;
    timestamp: string;
    code: string;
    success: boolean;
    duration: number;
    result?: any;
}

/**
 * History result
 */
export interface HistoryResult {
    entries: HistoryEntry[];
    totalCount: number;
}

/**
 * REPL client for communicating with the Groovy Language Server
 */
export class ReplClient {
    private client: LanguageClient | undefined;

    constructor(private getClient: () => LanguageClient | undefined) {}

    /**
     * Get the current language client
     */
    private getLanguageClient(): LanguageClient {
        const client = this.getClient();
        if (!client) {
            throw new Error('Language client not available');
        }
        return client;
    }

    /**
     * Create a new REPL session
     */
    async createSession(config?: SessionConfig): Promise<SessionCreateResult> {
        logger.info('Creating REPL session');

        try {
            const client = this.getLanguageClient();
            const result = await client.sendRequest('workspace/executeCommand', {
                command: 'groovy/repl/create',
                arguments: [
                    {
                        sessionId: config?.sessionId,
                        contextName: config?.contextName || 'main',
                        imports: config?.imports || [],
                        configuration: config?.configuration || {}
                    }
                ]
            }) as SessionCreateResult;

            logger.info(`REPL session created: ${result.sessionId}`);
            return result;
        } catch (error) {
            logger.error(`Failed to create REPL session: ${error}`);
            throw new Error(`Failed to create REPL session: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Evaluate code in a REPL session
     */
    async evaluate(sessionId: string, code: string, options?: {
        async?: boolean;
        includeBindings?: boolean;
        captureOutput?: boolean;
    }): Promise<EvaluationResult> {
        logger.debug(`Evaluating code in session ${sessionId}: ${code.substring(0, 100)}...`);

        try {
            const client = this.getLanguageClient();
            const result = await client.sendRequest('workspace/executeCommand', {
                command: 'groovy/repl/evaluate',
                arguments: [
                    {
                        sessionId,
                        code,
                        async: options?.async || false,
                        includeBindings: options?.includeBindings || false,
                        captureOutput: options?.captureOutput || true
                    }
                ]
            }) as EvaluationResult;

            logger.debug(`Evaluation result: ${result.success ? 'success' : 'failure'}`);
            return result;
        } catch (error) {
            logger.error(`Failed to evaluate code: ${error}`);
            return {
                success: false,
                error: {
                    message: error instanceof Error ? error.message : 'Unknown error',
                    type: 'LSPError'
                }
            };
        }
    }

    /**
     * Get code completions
     */
    async getCompletions(sessionId: string, code: string, position: number, options?: {
        includeBindings?: boolean;
        includeWorkspace?: boolean;
    }): Promise<CompletionResult> {
        logger.debug(`Getting completions for session ${sessionId} at position ${position}`);

        try {
            const client = this.getLanguageClient();
            const result = await client.sendRequest('workspace/executeCommand', {
                command: 'groovy/repl/complete',
                arguments: [
                    {
                        sessionId,
                        code,
                        position,
                        includeBindings: options?.includeBindings || true,
                        includeWorkspace: options?.includeWorkspace || true
                    }
                ]
            }) as CompletionResult;

            return result;
        } catch (error) {
            logger.error(`Failed to get completions: ${error}`);
            return {
                completions: [],
                bindingCompletions: []
            };
        }
    }

    /**
     * Inspect a variable
     */
    async inspectVariable(sessionId: string, variableName: string, options?: {
        includeMetaClass?: boolean;
        includeMethods?: boolean;
        includeProperties?: boolean;
    }): Promise<VariableInspectionResult | null> {
        logger.debug(`Inspecting variable ${variableName} in session ${sessionId}`);

        try {
            const client = this.getLanguageClient();
            const result = await client.sendRequest('workspace/executeCommand', {
                command: 'groovy/repl/inspect',
                arguments: [
                    {
                        sessionId,
                        variableName,
                        includeMetaClass: options?.includeMetaClass || false,
                        includeMethods: options?.includeMethods || true,
                        includeProperties: options?.includeProperties || true
                    }
                ]
            }) as VariableInspectionResult;

            return result;
        } catch (error) {
            logger.error(`Failed to inspect variable: ${error}`);
            return null;
        }
    }

    /**
     * Get command history
     */
    async getHistory(sessionId: string, options?: {
        limit?: number;
        offset?: number;
        includeResults?: boolean;
    }): Promise<HistoryResult> {
        logger.debug(`Getting history for session ${sessionId}`);

        try {
            const client = this.getLanguageClient();
            const result = await client.sendRequest('workspace/executeCommand', {
                command: 'groovy/repl/history',
                arguments: [
                    {
                        sessionId,
                        limit: options?.limit || 10,
                        offset: options?.offset || 0,
                        includeResults: options?.includeResults || false
                    }
                ]
            }) as HistoryResult;

            return result;
        } catch (error) {
            logger.error(`Failed to get history: ${error}`);
            return {
                entries: [],
                totalCount: 0
            };
        }
    }

    /**
     * Reset session state
     */
    async resetSession(sessionId: string): Promise<boolean> {
        logger.info(`Resetting session ${sessionId}`);

        try {
            const client = this.getLanguageClient();
            await client.sendRequest('workspace/executeCommand', {
                command: 'groovy/repl/reset',
                arguments: [{ sessionId }]
            });

            logger.info(`Session ${sessionId} reset successfully`);
            return true;
        } catch (error) {
            logger.error(`Failed to reset session: ${error}`);
            return false;
        }
    }

    /**
     * Destroy a session
     */
    async destroySession(sessionId: string): Promise<boolean> {
        logger.info(`Destroying session ${sessionId}`);

        try {
            const client = this.getLanguageClient();
            await client.sendRequest('workspace/executeCommand', {
                command: 'groovy/repl/destroy',
                arguments: [{ sessionId }]
            });

            logger.info(`Session ${sessionId} destroyed successfully`);
            return true;
        } catch (error) {
            logger.error(`Failed to destroy session: ${error}`);
            return false;
        }
    }

    /**
     * List active sessions
     */
    async listSessions(): Promise<string[]> {
        logger.debug('Listing active sessions');

        try {
            const client = this.getLanguageClient();
            const result = await client.sendRequest('workspace/executeCommand', {
                command: 'groovy/repl/list',
                arguments: [{}]
            }) as { sessions: string[] };

            return result.sessions || [];
        } catch (error) {
            logger.error(`Failed to list sessions: ${error}`);
            return [];
        }
    }

    /**
     * Switch compilation context
     */
    async switchContext(sessionId: string, contextName: string, options?: {
        preserveBindings?: boolean;
    }): Promise<{
        success: boolean;
        previousContext?: string;
        newContext?: string;
        preservedBindings?: string[];
        lostBindings?: string[];
        warnings?: string[];
    }> {
        logger.info(`Switching context for session ${sessionId} to ${contextName}`);

        try {
            const client = this.getLanguageClient();
            const result = await client.sendRequest('workspace/executeCommand', {
                command: 'groovy/repl/switchContext',
                arguments: [
                    {
                        sessionId,
                        contextName,
                        preserveBindings: options?.preserveBindings !== false
                    }
                ]
            }) as any;

            return result;
        } catch (error) {
            logger.error(`Failed to switch context: ${error}`);
            return {
                success: false,
                warnings: [error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }

    /**
     * Format evaluation result for display
     */
    formatResult(result: EvaluationResult): string {
        if (!result.success) {
            if (result.error) {
                let errorMessage = result.error.message;
                if (result.error.diagnostics && result.error.diagnostics.length > 0) {
                    errorMessage += '\n' + result.error.diagnostics
                        .map(d => `  ${d.message}`)
                        .join('\n');
                }
                return errorMessage;
            }
            return 'Evaluation failed';
        }

        let output = '';

        // Add any print output first
        if (result.sideEffects?.printOutput) {
            output += result.sideEffects.printOutput;
        }

        // Add the result value
        if (result.value !== undefined && result.value !== null) {
            if (output) output += '\n';
            output += `=> ${this.formatValue(result.value, result.type)}`;
        }

        // Add timing information if available
        if (result.duration !== undefined) {
            output += ` (${result.duration}ms)`;
        }

        return output || '(no output)';
    }

    /**
     * Format a value for display
     */
    private formatValue(value: any, type?: string): string {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';

        if (typeof value === 'string') {
            // Handle string values that might be complex objects
            try {
                const parsed = JSON.parse(value);
                if (typeof parsed === 'object') {
                    return JSON.stringify(parsed, null, 2);
                }
            } catch {
                // Not JSON, return as string
            }
            return value;
        }

        if (typeof value === 'object') {
            return JSON.stringify(value, null, 2);
        }

        return String(value);
    }

    /**
     * Check if the language client is available
     */
    isAvailable(): boolean {
        return this.getClient() !== undefined;
    }
}