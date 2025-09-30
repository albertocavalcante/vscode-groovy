import * as vscode from 'vscode';
import { logger } from '../utils/logger';

/**
 * Organizes imports in the current Groovy file
 */
export async function organizeImports(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor found');
        return;
    }

    const document = editor.document;
    if (!isGroovyFile(document)) {
        vscode.window.showWarningMessage('Current file is not a Groovy file');
        return;
    }

    try {
        // Get all import statements
        const text = document.getText();
        const imports = extractImports(text);

        if (imports.length === 0) {
            vscode.window.showInformationMessage('No imports found to organize');
            return;
        }

        // Sort and deduplicate imports
        const organizedImports = organizeImportStatements(imports);

        // Replace imports in document
        await replaceImports(editor, imports, organizedImports);

        logger.info('Imports organized successfully');
        vscode.window.showInformationMessage('Imports organized');
    } catch (error) {
        logger.error(`Error organizing imports: ${error}`);
        vscode.window.showErrorMessage('Failed to organize imports');
    }
}

/**
 * Generates getter and setter methods for a property
 */
export async function generateAccessors(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor found');
        return;
    }

    const document = editor.document;
    if (!isGroovyFile(document)) {
        vscode.window.showWarningMessage('Current file is not a Groovy file');
        return;
    }

    try {
        const selection = editor.selection;
        const selectedText = document.getText(selection);

        // Parse property from selection or current line
        const propertyInfo = parseProperty(selectedText || getCurrentLine(editor));

        if (!propertyInfo) {
            vscode.window.showWarningMessage('No valid property found. Select a property declaration.');
            return;
        }

        // Generate getter and setter
        const accessors = generateGetterSetter(propertyInfo);

        // Insert accessors after the class closing brace or at cursor
        const insertPosition = findInsertPosition(editor);
        await editor.edit(editBuilder => {
            editBuilder.insert(insertPosition, `\\n\\n${accessors}`);
        });

        logger.info('Accessors generated successfully');
        vscode.window.showInformationMessage('Getter and setter generated');
    } catch (error) {
        logger.error(`Error generating accessors: ${error}`);
        vscode.window.showErrorMessage('Failed to generate accessors');
    }
}

/**
 * Converts between String and GString
 */
export async function convertStringType(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor found');
        return;
    }

    const document = editor.document;
    if (!isGroovyFile(document)) {
        vscode.window.showWarningMessage('Current file is not a Groovy file');
        return;
    }

    try {
        const selection = editor.selection;
        let range: vscode.Range;
        let text: string;

        if (selection.isEmpty) {
            // Find string at cursor position
            const wordRange = document.getWordRangeAtPosition(selection.start, /"[^"]*"|'[^']*'/);
            if (!wordRange) {
                vscode.window.showWarningMessage('No string found at cursor position');
                return;
            }
            range = wordRange;
            text = document.getText(range);
        } else {
            range = selection;
            text = document.getText(selection);
        }

        const convertedText = convertStringFormat(text);

        if (convertedText === text) {
            vscode.window.showInformationMessage('String is already in the optimal format');
            return;
        }

        await editor.edit(editBuilder => {
            editBuilder.replace(range, convertedText);
        });

        logger.info('String type converted successfully');
        vscode.window.showInformationMessage('String format converted');
    } catch (error) {
        logger.error(`Error converting string type: ${error}`);
        vscode.window.showErrorMessage('Failed to convert string type');
    }
}

/**
 * Adds @CompileStatic annotation to current class
 */
export async function addCompileStatic(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor found');
        return;
    }

    const document = editor.document;
    if (!isGroovyFile(document)) {
        vscode.window.showWarningMessage('Current file is not a Groovy file');
        return;
    }

    try {
        const text = document.getText();

        // Check if already has @CompileStatic
        if (text.includes('@CompileStatic')) {
            vscode.window.showInformationMessage('Class already has @CompileStatic annotation');
            return;
        }

        // Find class declaration
        const classMatch = text.match(/^(\\s*)(class\\s+\\w+.*?)\\s*\\{/m);
        if (!classMatch) {
            vscode.window.showWarningMessage('No class declaration found');
            return;
        }

        const classLineStart = text.indexOf(classMatch[0]);
        const position = document.positionAt(classLineStart);

        // Add import if needed
        const needsImport = !text.includes('import groovy.transform.CompileStatic');
        let editText = '';

        if (needsImport) {
            const importPosition = findImportInsertPosition(document);
            await editor.edit(editBuilder => {
                editBuilder.insert(importPosition, 'import groovy.transform.CompileStatic\\n');
            });
        }

        // Add annotation
        const indent = classMatch[1];
        editText = `${indent}@CompileStatic\\n`;

        await editor.edit(editBuilder => {
            editBuilder.insert(position, editText);
        });

        logger.info('@CompileStatic annotation added successfully');
        vscode.window.showInformationMessage('@CompileStatic annotation added');
    } catch (error) {
        logger.error(`Error adding @CompileStatic: ${error}`);
        vscode.window.showErrorMessage('Failed to add @CompileStatic annotation');
    }
}

// Helper functions

function isGroovyFile(document: vscode.TextDocument): boolean {
    return document.languageId === 'groovy' || document.languageId === 'jenkinsfile';
}

function extractImports(text: string): ImportStatement[] {
    const importRegex = /^\\s*import\\s+(?:static\\s+)?([\\w.*]+)(?:\\s+as\\s+(\\w+))?\\s*$/gm;
    const imports: ImportStatement[] = [];
    let match;

    while ((match = importRegex.exec(text)) !== null) {
        imports.push({
            full: match[0],
            path: match[1],
            alias: match[2],
            isStatic: match[0].includes('static'),
            startIndex: match.index,
            endIndex: match.index + match[0].length
        });
    }

    return imports;
}

function organizeImportStatements(imports: ImportStatement[]): string[] {
    // Group imports by type
    const javaImports = imports.filter(imp => imp.path.startsWith('java.'));
    const groovyImports = imports.filter(imp => imp.path.startsWith('groovy.') || imp.path.startsWith('org.codehaus.groovy.'));
    const staticImports = imports.filter(imp => imp.isStatic);
    const otherImports = imports.filter(imp =>
        !imp.isStatic &&
        !imp.path.startsWith('java.') &&
        !imp.path.startsWith('groovy.') &&
        !imp.path.startsWith('org.codehaus.groovy.')
    );

    // Sort each group
    const sortImports = (imports: ImportStatement[]) =>
        imports.sort((a, b) => a.path.localeCompare(b.path));

    const organized: string[] = [];

    if (javaImports.length > 0) {
        organized.push(...sortImports(javaImports).map(imp => imp.full.trim()));
    }

    if (groovyImports.length > 0) {
        if (organized.length > 0) organized.push('');
        organized.push(...sortImports(groovyImports).map(imp => imp.full.trim()));
    }

    if (otherImports.length > 0) {
        if (organized.length > 0) organized.push('');
        organized.push(...sortImports(otherImports).map(imp => imp.full.trim()));
    }

    if (staticImports.length > 0) {
        if (organized.length > 0) organized.push('');
        organized.push(...sortImports(staticImports).map(imp => imp.full.trim()));
    }

    return organized;
}

async function replaceImports(editor: vscode.TextEditor, originalImports: ImportStatement[], organizedImports: string[]): Promise<void> {
    if (originalImports.length === 0) return;

    // Find the range of all imports
    const firstImport = originalImports[0];
    const lastImport = originalImports[originalImports.length - 1];

    const startPos = editor.document.positionAt(firstImport.startIndex);
    const endPos = editor.document.positionAt(lastImport.endIndex);

    // Include any trailing newlines
    let endLine = endPos.line;
    while (endLine < editor.document.lineCount - 1) {
        const nextLine = editor.document.lineAt(endLine + 1);
        if (nextLine.text.trim() === '') {
            endLine++;
        } else {
            break;
        }
    }

    const range = new vscode.Range(startPos.line, 0, endLine, editor.document.lineAt(endLine).text.length);
    const newText = organizedImports.join('\\n') + '\\n';

    await editor.edit(editBuilder => {
        editBuilder.replace(range, newText);
    });
}

function getCurrentLine(editor: vscode.TextEditor): string {
    const position = editor.selection.active;
    return editor.document.lineAt(position.line).text;
}

function parseProperty(text: string): PropertyInfo | null {
    // Match various property declarations
    const patterns = [
        /(?:private|public|protected)?\\s*(\\w+(?:<[^>]+>)?)\\s+(\\w+)(?:\\s*=.*)?/,
        /(\\w+)\\s+(\\w+)(?:\\s*=.*)?/
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return {
                type: match[1],
                name: match[2]
            };
        }
    }

    return null;
}

function generateGetterSetter(property: PropertyInfo): string {
    const capitalizedName = property.name.charAt(0).toUpperCase() + property.name.slice(1);

    return `    ${property.type} get${capitalizedName}() {
        return ${property.name}
    }

    void set${capitalizedName}(${property.type} ${property.name}) {
        this.${property.name} = ${property.name}
    }`;
}

function findInsertPosition(editor: vscode.TextEditor): vscode.Position {
    const selection = editor.selection;
    return selection.end;
}

function convertStringFormat(text: string): string {
    // Remove quotes for analysis
    const content = text.slice(1, -1);
    const hasInterpolation = content.includes('${') || content.includes('$');

    if (text.startsWith('"') && text.endsWith('"')) {
        // Double quoted string
        if (hasInterpolation) {
            return text; // Already GString format
        } else {
            return `'${content}'`; // Convert to single quotes if no interpolation
        }
    } else if (text.startsWith("'") && text.endsWith("'")) {
        // Single quoted string
        if (hasInterpolation) {
            return `"${content}"`; // Convert to double quotes for interpolation
        } else {
            return text; // Keep as single quotes
        }
    }

    return text;
}

function findImportInsertPosition(document: vscode.TextDocument): vscode.Position {
    const text = document.getText();

    // Look for package declaration
    const packageMatch = text.match(/^package\\s+[\\w.]+\\s*$/m);
    if (packageMatch) {
        const packageEnd = text.indexOf(packageMatch[0]) + packageMatch[0].length;
        const position = document.positionAt(packageEnd);
        return new vscode.Position(position.line + 1, 0);
    }

    // Look for existing imports
    const importMatch = text.match(/^import\\s+/m);
    if (importMatch) {
        const importStart = text.indexOf(importMatch[0]);
        const position = document.positionAt(importStart);
        return new vscode.Position(position.line, 0);
    }

    // Insert at the beginning
    return new vscode.Position(0, 0);
}

// Interfaces

interface ImportStatement {
    full: string;
    path: string;
    alias?: string;
    isStatic: boolean;
    startIndex: number;
    endIndex: number;
}

interface PropertyInfo {
    type: string;
    name: string;
}