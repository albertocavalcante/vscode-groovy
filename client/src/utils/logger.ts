import * as vscode from 'vscode';

/**
 * Lightweight colored logger for VSCode extension
 * Outputs to VSCode Output panel with ANSI colors
 */
class ExtensionLogger {
    private static instance: ExtensionLogger;
    private outputChannel: vscode.OutputChannel | null = null;
    private readonly channelName = 'Groovy Extension';

    private constructor() {}

    public static getInstance(): ExtensionLogger {
        if (!ExtensionLogger.instance) {
            ExtensionLogger.instance = new ExtensionLogger();
        }
        return ExtensionLogger.instance;
    }

    private getChannel(): vscode.OutputChannel {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel(this.channelName);
        }
        return this.outputChannel;
    }

    private formatMessage(level: string, message: string, color: string): string {
        const timestamp = new Date().toISOString().substring(11, 23);
        return `\u001b[${color}m[${timestamp}] [${level}]\u001b[0m ${message}`;
    }

    public info(message: string): void {
        this.getChannel().appendLine(this.formatMessage('INFO ', message, '32')); // Green
    }

    public warn(message: string): void {
        this.getChannel().appendLine(this.formatMessage('WARN ', message, '33')); // Yellow
    }

    public error(message: string): void {
        this.getChannel().appendLine(this.formatMessage('ERROR', message, '31')); // Red
    }

    public debug(message: string): void {
        // Only log debug if trace is enabled
        const config = vscode.workspace.getConfiguration('groovy');
        if (config.get('trace.server') === 'verbose') {
            this.getChannel().appendLine(this.formatMessage('DEBUG', message, '36')); // Cyan
        }
    }

    public show(): void {
        this.getChannel().show();
    }

    public dispose(): void {
        if (this.outputChannel) {
            this.outputChannel.dispose();
            this.outputChannel = null;
        }
    }
}

// Export singleton instance
export const logger = ExtensionLogger.getInstance();