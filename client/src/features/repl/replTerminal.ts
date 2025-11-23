import * as vscode from 'vscode';
import { logger } from '../../utils/logger';

/**
 * History management for REPL commands
 */
class ReplHistory {
    private history: string[] = [];
    private currentIndex = -1;
    private maxSize: number;

    constructor(maxSize = 1000) {
        this.maxSize = maxSize;
    }

    add(command: string): void {
        if (command.trim() && this.history[this.history.length - 1] !== command) {
            this.history.push(command);
            if (this.history.length > this.maxSize) {
                this.history.shift();
            }
        }
        this.currentIndex = this.history.length;
    }

    getPrevious(): string | undefined {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            return this.history[this.currentIndex];
        }
        return undefined;
    }

    getNext(): string | undefined {
        if (this.currentIndex < this.history.length - 1) {
            this.currentIndex++;
            return this.history[this.currentIndex];
        } else if (this.currentIndex === this.history.length - 1) {
            this.currentIndex = this.history.length;
            return '';
        }
        return undefined;
    }

    reset(): void {
        this.currentIndex = this.history.length;
    }
}

/**
 * ANSI color codes for terminal output formatting
 */
export const Colors = {
    RESET: '\x1b[0m',
    BOLD: '\x1b[1m',
    DIM: '\x1b[2m',

    // Regular colors
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    MAGENTA: '\x1b[35m',
    CYAN: '\x1b[36m',
    WHITE: '\x1b[37m',
    GRAY: '\x1b[90m',

    // Bright colors
    BRIGHT_RED: '\x1b[91m',
    BRIGHT_GREEN: '\x1b[92m',
    BRIGHT_YELLOW: '\x1b[93m',
    BRIGHT_BLUE: '\x1b[94m',
    BRIGHT_MAGENTA: '\x1b[95m',
    BRIGHT_CYAN: '\x1b[96m',
    BRIGHT_WHITE: '\x1b[97m'
} as const;

/**
 * Interface for REPL terminal events
 */
export interface ReplTerminalEvents {
    onEvaluate: (code: string) => Promise<void>;
    onComplete?: (code: string, position: number) => Promise<string[]>;
    onClear?: () => void;
    onRestart?: () => Promise<void>;
}

/**
 * Groovy REPL Terminal implementation using VSCode's PseudoTerminal API
 */
export class GroovyReplTerminal {
    private writeEmitter = new vscode.EventEmitter<string>();
    private currentLine = '';
    private currentCursorPosition = 0;
    private history = new ReplHistory();
    private sessionId: string | undefined;
    private isMultilineInput = false;
    private multilineBuffer: string[] = [];
    private isEvaluating = false;

    private readonly PROMPT = 'groovy> ';
    private readonly CONTINUATION_PROMPT = '     | ';

    constructor(private events: ReplTerminalEvents) {}

    /**
     * Creates and returns a PseudoTerminal instance
     */
    createPseudoTerminal(): vscode.Pseudoterminal {
        return {
            onDidWrite: this.writeEmitter.event,
            open: () => this.initialize(),
            close: () => this.cleanup(),
            handleInput: (data: string) => this.processInput(data)
        };
    }

    /**
     * Initialize the REPL terminal
     */
    private initialize(): void {
        this.writeWelcomeMessage();
        this.showPrompt();
    }

    /**
     * Cleanup when terminal is closed
     */
    private cleanup(): void {
        logger.info('REPL terminal closed');
    }

    /**
     * Display welcome message
     */
    private writeWelcomeMessage(): void {
        const welcomeMessage = [
            `${Colors.BRIGHT_GREEN}${Colors.BOLD}Groovy REPL${Colors.RESET}`,
            `${Colors.GRAY}Connected to Groovy Language Server${Colors.RESET}`,
            '',
            `${Colors.CYAN}Tips:${Colors.RESET}`,
            `${Colors.GRAY}  • Type Groovy expressions and press Enter to evaluate${Colors.RESET}`,
            `${Colors.GRAY}  • Use Up/Down arrows for command history${Colors.RESET}`,
            `${Colors.GRAY}  • Type :help for more commands${Colors.RESET}`,
            `${Colors.GRAY}  • Press Ctrl+C to interrupt evaluation${Colors.RESET}`,
            '',
        ].join('\r\n');

        this.writeEmitter.fire(welcomeMessage + '\r\n');
    }

    /**
     * Show the current prompt
     */
    private showPrompt(): void {
        const prompt = this.isMultilineInput ? this.CONTINUATION_PROMPT : this.PROMPT;
        this.writeEmitter.fire(`${Colors.BRIGHT_BLUE}${prompt}${Colors.RESET}`);
        this.currentCursorPosition = 0;
    }

    /**
     * Process user input
     */
    private async processInput(data: string): Promise<void> {
        // Handle special characters
        if (data === '\r') { // Enter
            await this.handleEnter();
        } else if (data === '\x7f') { // Backspace
            this.handleBackspace();
        } else if (data === '\x1b[A') { // Up arrow
            this.handleHistoryUp();
        } else if (data === '\x1b[B') { // Down arrow
            this.handleHistoryDown();
        } else if (data === '\x1b[C') { // Right arrow
            this.handleRightArrow();
        } else if (data === '\x1b[D') { // Left arrow
            this.handleLeftArrow();
        } else if (data === '\x03') { // Ctrl+C
            this.handleInterrupt();
        } else if (data === '\x0c') { // Ctrl+L
            await this.handleClear();
        } else if (data.charCodeAt(0) >= 32) { // Printable characters
            this.handlePrintableChar(data);
        }
    }

    /**
     * Handle Enter key press
     */
    private async handleEnter(): Promise<void> {
        this.writeEmitter.fire('\r\n');

        if (this.isEvaluating) {
            this.writeEmitter.fire(`${Colors.YELLOW}Please wait for current evaluation to complete...${Colors.RESET}\r\n`);
            this.showPrompt();
            return;
        }

        const line = this.currentLine.trim();

        // Handle special commands
        if (line.startsWith(':')) {
            await this.handleSpecialCommand(line);
            this.resetInput();
            this.showPrompt();
            return;
        }

        // Handle multiline input
        if (this.isMultilineInput) {
            this.multilineBuffer.push(this.currentLine);

            // Check if we should end multiline input
            if (line === '' || this.isCompleteExpression()) {
                const code = this.multilineBuffer.join('\n');
                this.multilineBuffer = [];
                this.isMultilineInput = false;

                if (code.trim()) {
                    await this.evaluateCode(code);
                }
            } else {
                this.resetInput();
                this.showPrompt();
                return;
            }
        } else {
            // Single line input
            if (line === '') {
                this.showPrompt();
                return;
            }

            // Check if this starts a multiline expression
            if (this.shouldStartMultiline(line)) {
                this.isMultilineInput = true;
                this.multilineBuffer = [this.currentLine];
                this.resetInput();
                this.showPrompt();
                return;
            }

            await this.evaluateCode(line);
        }

        this.resetInput();
        this.showPrompt();
    }

    /**
     * Handle special REPL commands
     */
    private async handleSpecialCommand(command: string): Promise<void> {
        const cmd = command.substring(1).toLowerCase();

        switch (cmd) {
            case 'help':
                this.showHelp();
                break;
            case 'clear':
                await this.handleClear();
                break;
            case 'restart':
                await this.handleRestart();
                break;
            case 'history':
                this.showHistory();
                break;
            default:
                this.writeEmitter.fire(`${Colors.RED}Unknown command: ${command}${Colors.RESET}\r\n`);
                this.writeEmitter.fire(`${Colors.GRAY}Type :help for available commands${Colors.RESET}\r\n`);
        }
    }

    /**
     * Show help information
     */
    private showHelp(): void {
        const helpText = [
            `${Colors.CYAN}${Colors.BOLD}Available Commands:${Colors.RESET}`,
            `${Colors.GRAY}  :help     - Show this help message${Colors.RESET}`,
            `${Colors.GRAY}  :clear    - Clear the terminal${Colors.RESET}`,
            `${Colors.GRAY}  :restart  - Restart the REPL session${Colors.RESET}`,
            `${Colors.GRAY}  :history  - Show command history${Colors.RESET}`,
            '',
            `${Colors.CYAN}${Colors.BOLD}Keyboard Shortcuts:${Colors.RESET}`,
            `${Colors.GRAY}  Ctrl+C    - Interrupt current evaluation${Colors.RESET}`,
            `${Colors.GRAY}  Ctrl+L    - Clear screen${Colors.RESET}`,
            `${Colors.GRAY}  Up/Down   - Navigate command history${Colors.RESET}`,
            `${Colors.GRAY}  Tab       - Auto-completion (if available)${Colors.RESET}`,
            ''
        ].join('\r\n');

        this.writeEmitter.fire(helpText + '\r\n');
    }

    /**
     * Show command history
     */
    private showHistory(): void {
        const historyItems = (this.history as any).history as string[];
        if (historyItems.length === 0) {
            this.writeEmitter.fire(`${Colors.GRAY}No command history${Colors.RESET}\r\n`);
            return;
        }

        this.writeEmitter.fire(`${Colors.CYAN}${Colors.BOLD}Command History:${Colors.RESET}\r\n`);
        historyItems.slice(-10).forEach((item, index) => {
            const lineNum = historyItems.length - 10 + index + 1;
            this.writeEmitter.fire(`${Colors.GRAY}${lineNum.toString().padStart(3)}: ${item}${Colors.RESET}\r\n`);
        });
        this.writeEmitter.fire('\r\n');
    }

    /**
     * Evaluate Groovy code
     */
    private async evaluateCode(code: string): Promise<void> {
        this.history.add(code);
        this.isEvaluating = true;

        try {
            this.writeEmitter.fire(`${Colors.DIM}Evaluating...${Colors.RESET}\r\n`);
            await this.events.onEvaluate(code);
        } catch (error) {
            this.writeEmitter.fire(`${Colors.RED}Error: ${error}${Colors.RESET}\r\n`);
        } finally {
            this.isEvaluating = false;
        }
    }

    /**
     * Handle backspace
     */
    private handleBackspace(): void {
        if (this.currentCursorPosition > 0) {
            this.currentLine =
                this.currentLine.substring(0, this.currentCursorPosition - 1) +
                this.currentLine.substring(this.currentCursorPosition);
            this.currentCursorPosition--;

            // Update display
            this.writeEmitter.fire('\x1b[D\x1b[K' + this.currentLine.substring(this.currentCursorPosition));
            // Move cursor back to correct position
            const charsToMoveBack = this.currentLine.length - this.currentCursorPosition;
            if (charsToMoveBack > 0) {
                this.writeEmitter.fire('\x1b[' + charsToMoveBack + 'D');
            }
        }
    }

    /**
     * Handle history navigation - up arrow
     */
    private handleHistoryUp(): void {
        const previousCommand = this.history.getPrevious();
        if (previousCommand !== undefined) {
            this.replaceCurrentLine(previousCommand);
        }
    }

    /**
     * Handle history navigation - down arrow
     */
    private handleHistoryDown(): void {
        const nextCommand = this.history.getNext();
        if (nextCommand !== undefined) {
            this.replaceCurrentLine(nextCommand);
        }
    }

    /**
     * Replace current line with new content
     */
    private replaceCurrentLine(newContent: string): void {
        // Clear current line
        this.writeEmitter.fire('\x1b[2K\r');
        this.showPrompt();

        // Write new content
        this.currentLine = newContent;
        this.currentCursorPosition = newContent.length;
        this.writeEmitter.fire(newContent);
    }

    /**
     * Handle right arrow key
     */
    private handleRightArrow(): void {
        if (this.currentCursorPosition < this.currentLine.length) {
            this.currentCursorPosition++;
            this.writeEmitter.fire('\x1b[C');
        }
    }

    /**
     * Handle left arrow key
     */
    private handleLeftArrow(): void {
        if (this.currentCursorPosition > 0) {
            this.currentCursorPosition--;
            this.writeEmitter.fire('\x1b[D');
        }
    }

    /**
     * Handle printable characters
     */
    private handlePrintableChar(char: string): void {
        // Insert character at cursor position
        this.currentLine =
            this.currentLine.substring(0, this.currentCursorPosition) +
            char +
            this.currentLine.substring(this.currentCursorPosition);

        this.currentCursorPosition++;

        // Update display
        this.writeEmitter.fire(char);

        // If we inserted in the middle, redraw the rest of the line
        if (this.currentCursorPosition < this.currentLine.length) {
            const remaining = this.currentLine.substring(this.currentCursorPosition);
            this.writeEmitter.fire(remaining);
            // Move cursor back to correct position
            this.writeEmitter.fire('\x1b[' + remaining.length + 'D');
        }
    }

    /**
     * Handle interrupt (Ctrl+C)
     */
    private handleInterrupt(): void {
        this.writeEmitter.fire(`${Colors.YELLOW}^C${Colors.RESET}\r\n`);
        this.resetInput();
        this.isMultilineInput = false;
        this.multilineBuffer = [];
        this.showPrompt();
    }

    /**
     * Handle clear screen (Ctrl+L)
     */
    private async handleClear(): Promise<void> {
        this.writeEmitter.fire('\x1b[2J\x1b[3J\x1b[;H'); // Clear screen and move cursor to top
        if (this.events.onClear) {
            await this.events.onClear();
        }
        this.showPrompt();
    }

    /**
     * Handle restart
     */
    private async handleRestart(): Promise<void> {
        this.writeEmitter.fire(`${Colors.YELLOW}Restarting REPL session...${Colors.RESET}\r\n`);
        if (this.events.onRestart) {
            await this.events.onRestart();
        }
        this.sessionId = undefined;
        this.resetInput();
        this.showPrompt();
    }

    /**
     * Reset input state
     */
    private resetInput(): void {
        this.currentLine = '';
        this.currentCursorPosition = 0;
        this.history.reset();
    }

    /**
     * Check if current input should start multiline mode
     */
    private shouldStartMultiline(line: string): boolean {
        const trimmed = line.trim();
        return (
            trimmed.endsWith('{') ||
            trimmed.endsWith('\\') ||
            trimmed.match(/^(class|def|if|while|for|try|catch|finally)\s/) !== null
        );
    }

    /**
     * Check if current multiline expression is complete
     */
    private isCompleteExpression(): boolean {
        const code = this.multilineBuffer.join('\n') + '\n' + this.currentLine;
        const openBraces = (code.match(/\{/g) || []).length;
        const closeBraces = (code.match(/\}/g) || []).length;
        const openParens = (code.match(/\(/g) || []).length;
        const closeParens = (code.match(/\)/g) || []).length;
        const openBrackets = (code.match(/\[/g) || []).length;
        const closeBrackets = (code.match(/\]/g) || []).length;

        return openBraces === closeBraces &&
               openParens === closeParens &&
               openBrackets === closeBrackets;
    }

    /**
     * Write evaluation result to terminal
     */
    public writeResult(result: any, isError = false): void {
        if (isError) {
            this.writeEmitter.fire(`${Colors.RED}${result}${Colors.RESET}\r\n`);
        } else {
            this.writeEmitter.fire(`${Colors.GREEN}${result}${Colors.RESET}\r\n`);
        }
    }

    /**
     * Write output (print statements, etc.)
     */
    public writeOutput(output: string): void {
        if (output) {
            this.writeEmitter.fire(`${Colors.WHITE}${output}${Colors.RESET}\r\n`);
        }
    }

    /**
     * Set session ID
     */
    public setSessionId(sessionId: string): void {
        this.sessionId = sessionId;
        logger.info(`REPL session ID set: ${sessionId}`);
    }

    /**
     * Get current session ID
     */
    public getSessionId(): string | undefined {
        return this.sessionId;
    }
}