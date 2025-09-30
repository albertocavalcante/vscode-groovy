import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../../utils/logger';

/**
 * Gradle project utilities
 */
export class GradleUtils {
    /**
     * Checks if the current workspace is a Gradle project
     */
    static isGradleProject(workspaceFolder?: vscode.WorkspaceFolder): boolean {
        if (!workspaceFolder) {
            const folders = vscode.workspace.workspaceFolders;
            if (!folders || folders.length === 0) {
                return false;
            }
            workspaceFolder = folders[0];
        }

        const buildFiles = [
            'build.gradle',
            'build.gradle.kts',
            'settings.gradle',
            'settings.gradle.kts'
        ];

        return buildFiles.some(file =>
            fs.existsSync(path.join(workspaceFolder!.uri.fsPath, file))
        );
    }

    /**
     * Gets the Gradle wrapper command for the workspace
     */
    static getGradleCommand(workspaceFolder?: vscode.WorkspaceFolder): string {
        if (!workspaceFolder) {
            const folders = vscode.workspace.workspaceFolders;
            if (!folders || folders.length === 0) {
                return 'gradle';
            }
            workspaceFolder = folders[0];
        }

        const isWindows = process.platform === 'win32';
        const wrapperScript = isWindows ? 'gradlew.bat' : 'gradlew';
        const wrapperPath = path.join(workspaceFolder.uri.fsPath, wrapperScript);

        if (fs.existsSync(wrapperPath)) {
            return isWindows ? wrapperPath : './gradlew';
        }

        return 'gradle';
    }

    /**
     * Finds all build.gradle files in the workspace
     */
    static async findBuildFiles(workspaceFolder?: vscode.WorkspaceFolder): Promise<vscode.Uri[]> {
        const pattern = new vscode.RelativePattern(
            workspaceFolder || vscode.workspace.workspaceFolders![0],
            '**/build.gradle*'
        );

        return await vscode.workspace.findFiles(pattern, '**/node_modules/**');
    }

    /**
     * Parses build.gradle file to extract project information
     */
    static async parseBuildFile(buildFile: vscode.Uri): Promise<GradleProjectInfo> {
        try {
            const content = fs.readFileSync(buildFile.fsPath, 'utf8');
            return this.extractProjectInfo(content);
        } catch (error) {
            logger.error(`Error parsing build file ${buildFile.fsPath}: ${error}`);
            return { plugins: [], dependencies: [], tasks: [] };
        }
    }

    /**
     * Extracts project information from build.gradle content
     */
    private static extractProjectInfo(content: string): GradleProjectInfo {
        const info: GradleProjectInfo = {
            plugins: [],
            dependencies: [],
            tasks: []
        };

        // Extract plugins
        const pluginPatterns = [
            /id\s+['"]([^'"]+)['"](?:\s+version\s+['"]([^'"]+)['"])?/g,
            /apply\s+plugin:\s*['"]([^'"]+)['"]/g
        ];

        for (const pattern of pluginPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                info.plugins.push({
                    id: match[1],
                    version: match[2]
                });
            }
        }

        // Extract dependencies
        const dependencyPattern = /(implementation|testImplementation|api|compileOnly|runtimeOnly|annotationProcessor)\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = dependencyPattern.exec(content)) !== null) {
            info.dependencies.push({
                configuration: match[1],
                coordinates: match[2]
            });
        }

        // Extract custom tasks
        const taskPatterns = [
            /task\s+(\w+)\s*\{/g,
            /task\s*\(\s*['"](\w+)['"]\s*\)/g,
            /tasks\.register\s*\(\s*['"](\w+)['"]\s*\)/g
        ];

        for (const pattern of taskPatterns) {
            let taskMatch;
            while ((taskMatch = pattern.exec(content)) !== null) {
                const taskName = taskMatch[1];
                if (taskName && !info.tasks.includes(taskName)) {
                    info.tasks.push(taskName);
                }
            }
        }

        return info;
    }

    /**
     * Runs a Gradle task in the integrated terminal
     */
    static async runGradleTask(taskName: string, workspaceFolder?: vscode.WorkspaceFolder): Promise<void> {
        const folder = workspaceFolder || vscode.workspace.workspaceFolders![0];
        const gradleCommand = this.getGradleCommand(folder);

        const terminal = vscode.window.createTerminal({
            name: `Gradle: ${taskName}`,
            cwd: folder.uri.fsPath
        });

        terminal.sendText(`${gradleCommand} ${taskName}`);
        terminal.show();
    }

    /**
     * Gets the project dependencies via Gradle command
     */
    static async getDependencies(workspaceFolder?: vscode.WorkspaceFolder): Promise<string[]> {
        const folder = workspaceFolder || vscode.workspace.workspaceFolders![0];
        const gradleCommand = this.getGradleCommand(folder);

        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            const process = spawn(gradleCommand, ['dependencies', '--configuration', 'compileClasspath'], {
                cwd: folder.uri.fsPath,
                shell: true
            });

            let output = '';
            process.stdout.on('data', (data: Buffer) => {
                output += data.toString();
            });

            process.on('close', (code: number) => {
                if (code === 0) {
                    const dependencies = this.parseDependencyOutput(output);
                    resolve(dependencies);
                } else {
                    reject(new Error(`Gradle process exited with code ${code}`));
                }
            });

            process.on('error', (error: Error) => {
                reject(error);
            });
        });
    }

    /**
     * Parses dependency tree output from Gradle
     */
    private static parseDependencyOutput(output: string): string[] {
        const dependencies: string[] = [];
        const lines = output.split('\n');

        for (const line of lines) {
            // Match dependency lines like "+--- org.apache.groovy:groovy-all:4.0.15"
            // Fixed ReDoS vulnerability by using atomic groups and limiting quantifiers
            const match = line.match(/^[+\\\-`\s]{0,20}([a-zA-Z0-9._-]{1,100}:[a-zA-Z0-9._-]{1,100}:[a-zA-Z0-9._-]{1,50})/);
            if (match) {
                dependencies.push(match[1]);
            }
        }

        return [...new Set(dependencies)]; // Remove duplicates
    }

    /**
     * Shows Gradle project information in a quickpick
     */
    static async showProjectInfo(): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder || !this.isGradleProject(workspaceFolder)) {
            vscode.window.showWarningMessage('No Gradle project found in workspace');
            return;
        }

        try {
            const buildFiles = await this.findBuildFiles(workspaceFolder);
            if (buildFiles.length === 0) {
                vscode.window.showWarningMessage('No build.gradle files found');
                return;
            }

            const projectInfo = await this.parseBuildFile(buildFiles[0]);

            const items: vscode.QuickPickItem[] = [
                {
                    label: 'Plugins',
                    detail: `${projectInfo.plugins.length} plugins configured`,
                    description: projectInfo.plugins.map(p => p.id).join(', ')
                },
                {
                    label: 'Dependencies',
                    detail: `${projectInfo.dependencies.length} dependencies`,
                    description: projectInfo.dependencies.slice(0, 3).map(d => d.coordinates).join(', ')
                },
                {
                    label: 'Custom Tasks',
                    detail: `${projectInfo.tasks.length} custom tasks`,
                    description: projectInfo.tasks.join(', ')
                }
            ];

            await vscode.window.showQuickPick(items, {
                title: 'Gradle Project Information',
                placeHolder: 'Select an item to view details'
            });
        } catch (error) {
            logger.error(`Error showing project info: ${error}`);
            vscode.window.showErrorMessage('Failed to load project information');
        }
    }
}

/**
 * Gradle project information interface
 */
export interface GradleProjectInfo {
    plugins: GradlePlugin[];
    dependencies: GradleDependency[];
    tasks: string[];
}

export interface GradlePlugin {
    id: string;
    version?: string;
}

export interface GradleDependency {
    configuration: string;
    coordinates: string;
}