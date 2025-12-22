/**
 * Type definitions for AI Tool Services
 */

import * as vscode from 'vscode';

/**
 * Represents a simplified symbol information for LLM consumption
 */
export interface AISymbolInfo {
    name: string;
    kind: string;
    containerName: string;
    location: {
        uri: string;
        range: {
            start: { line: number; character: number };
            end: { line: number; character: number };
        };
    };
}

/**
 * Represents a simplified location for LLM consumption
 */
export interface AILocation {
    uri: string;
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
}

/**
 * Interface for the core LSP Tool Service
 */
export interface ILSPToolService {
    /**
     * Finds a symbol in the workspace by name query
     */
    findWorkspaceSymbol(query: string): Promise<AISymbolInfo[]>;

    /**
     * Finds references to the symbol at the given location
     */
    findReferences(uri: string, line: number, character: number): Promise<AILocation[]>;

    /**
     * Finds the definition of the symbol at the given location
     */
    getDefinition(uri: string, line: number, character: number): Promise<AILocation | null>;
}
