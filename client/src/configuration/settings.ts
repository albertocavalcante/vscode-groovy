import { workspace, ConfigurationChangeEvent } from 'vscode';

export interface GroovyConfiguration {
    javaHome: string | undefined;
    traceServer: 'off' | 'messages' | 'verbose';
    maxNumberOfProblems: number;
    compilationMode: 'workspace' | 'single-file';
    incrementalThreshold: number;
    maxWorkspaceFiles: number;
    serverDownloadUrl: string | undefined;
}

/**
 * Gets the current Groovy configuration
 */
export function getConfiguration(): GroovyConfiguration {
    const config = workspace.getConfiguration('groovy');

    return {
        javaHome: config.get<string>('java.home'),
        traceServer: config.get<'off' | 'messages' | 'verbose'>('trace.server', 'off'),
        maxNumberOfProblems: config.get<number>('server.maxNumberOfProblems', 100),
        compilationMode: config.get<'workspace' | 'single-file'>('compilation.mode', 'workspace'),
        incrementalThreshold: config.get<number>('compilation.incrementalThreshold', 50),
        maxWorkspaceFiles: config.get<number>('compilation.maxWorkspaceFiles', 500),
        serverDownloadUrl: config.get<string>('server.downloadUrl')
    };
}

/**
 * Checks if a configuration change affects the specified section
 */
export function affectsConfiguration(event: ConfigurationChangeEvent, section: string): boolean {
    return event.affectsConfiguration(`groovy.${section}`);
}

/**
 * Checks if a configuration change affects Java settings
 */
export function affectsJavaConfiguration(event: ConfigurationChangeEvent): boolean {
    return affectsConfiguration(event, 'java.home');
}

/**
 * Checks if a configuration change affects server settings
 */
export function affectsServerConfiguration(event: ConfigurationChangeEvent): boolean {
    return affectsConfiguration(event, 'trace.server') ||
           affectsConfiguration(event, 'server.maxNumberOfProblems') ||
           affectsConfiguration(event, 'server.downloadUrl');
}

/**
 * Checks if a configuration change affects compilation settings
 */
export function affectsCompilationConfiguration(event: ConfigurationChangeEvent): boolean {
    return affectsConfiguration(event, 'compilation.mode') ||
           affectsConfiguration(event, 'compilation.incrementalThreshold') ||
           affectsConfiguration(event, 'compilation.maxWorkspaceFiles');
}