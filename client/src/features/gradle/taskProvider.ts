import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../../utils/logger';

/**
 * Gradle Task Provider for VS Code
 */
export class GradleTaskProvider implements vscode.TaskProvider {
    static readonly TYPE = 'gradle';
    private tasks: vscode.Task[] | undefined;

    constructor(private workspaceRoot: string) {}

    public async provideTasks(): Promise<vscode.Task[]> {
        return this.getTasks();
    }

    public resolveTask(task: vscode.Task): vscode.Task | undefined {
        const taskName = task.definition.task;
        if (taskName) {
            const definition: GradleTaskDefinition = <any>task.definition;
            return this.getTask(definition.task, definition);
        }
        return undefined;
    }

    private async getTasks(): Promise<vscode.Task[]> {
        if (this.tasks !== undefined) {
            return this.tasks;
        }

        this.tasks = [];

        if (!this.workspaceRoot) {
            return this.tasks;
        }

        try {
            // Check if this is a Gradle project
            if (!this.isGradleProject()) {
                return this.tasks;
            }

            // Add standard Gradle tasks
            this.addStandardTasks();

            // Parse build.gradle for custom tasks
            await this.parseCustomTasks();

            logger.info(`Found ${this.tasks.length} Gradle tasks`);
        } catch (error) {
            logger.error(`Error discovering Gradle tasks: ${error}`);
        }

        return this.tasks;
    }

    private isGradleProject(): boolean {
        const buildFiles = [
            'build.gradle',
            'build.gradle.kts',
            'settings.gradle',
            'settings.gradle.kts'
        ];

        return buildFiles.some(file =>
            fs.existsSync(path.join(this.workspaceRoot, file))
        );
    }

    private addStandardTasks(): void {
        const standardTasks = [
            { name: 'build', group: 'build', description: 'Assembles and tests this project' },
            { name: 'clean', group: 'build', description: 'Deletes the build directory' },
            { name: 'assemble', group: 'build', description: 'Assembles the outputs of this project' },
            { name: 'test', group: 'verification', description: 'Runs the unit tests' },
            { name: 'check', group: 'verification', description: 'Runs all checks' },
            { name: 'run', group: 'application', description: 'Runs this project as a JVM application' },
            { name: 'bootRun', group: 'application', description: 'Runs this project as a Spring Boot application' },
            { name: 'dependencies', group: 'help', description: 'Displays all dependencies' },
            { name: 'tasks', group: 'help', description: 'Displays the tasks runnable from this project' },
            { name: 'properties', group: 'help', description: 'Displays the properties of this project' }
        ];

        for (const taskInfo of standardTasks) {
            const task = this.getTask(taskInfo.name, { type: GradleTaskProvider.TYPE, task: taskInfo.name });
            if (task) {
                task.group = this.getTaskGroup(taskInfo.group);
                task.detail = taskInfo.description;
                this.tasks!.push(task);
            }
        }
    }

    private async parseCustomTasks(): Promise<void> {
        const buildFiles = ['build.gradle', 'build.gradle.kts'];

        for (const buildFile of buildFiles) {
            const buildPath = path.join(this.workspaceRoot, buildFile);
            if (fs.existsSync(buildPath)) {
                try {
                    const content = fs.readFileSync(buildPath, 'utf8');
                    const customTasks = this.extractTasksFromBuildFile(content);

                    for (const taskName of customTasks) {
                        const task = this.getTask(taskName, { type: GradleTaskProvider.TYPE, task: taskName });
                        if (task) {
                            task.group = vscode.TaskGroup.Build;
                            task.detail = `Custom task from ${buildFile}`;
                            this.tasks!.push(task);
                        }
                    }
                } catch (error) {
                    logger.error(`Error parsing ${buildFile}: ${error}`);
                }
            }
        }
    }

    private extractTasksFromBuildFile(content: string): string[] {
        const tasks: string[] = [];

        // Match task definitions: task taskName { ... } or task('taskName') { ... }
        const taskPatterns = [
            /task\s+(\w+)\s*\{/g,
            /task\s*\(\s*['"](\w+)['"]\s*\)/g,
            /tasks\.register\s*\(\s*['"](\w+)['"]\s*\)/g
        ];

        for (const pattern of taskPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const taskName = match[1];
                if (taskName && !tasks.includes(taskName)) {
                    tasks.push(taskName);
                }
            }
        }

        return tasks;
    }

    private getTask(taskName: string, definition: GradleTaskDefinition): vscode.Task | undefined {
        const gradleCommand = this.getGradleCommand();
        if (!gradleCommand) {
            return undefined;
        }

        const execution = new vscode.ShellExecution(gradleCommand, [taskName], {
            cwd: this.workspaceRoot
        });

        const task = new vscode.Task(
            definition,
            vscode.TaskScope.Workspace,
            taskName,
            GradleTaskProvider.TYPE,
            execution
        );

        // Set problem matcher for Gradle output
        task.problemMatchers = ['$gradle'];

        return task;
    }

    private getGradleCommand(): string | undefined {
        // Check for Gradle wrapper first
        const isWindows = process.platform === 'win32';
        const wrapperScript = isWindows ? 'gradlew.bat' : 'gradlew';
        const wrapperPath = path.join(this.workspaceRoot, wrapperScript);

        if (fs.existsSync(wrapperPath)) {
            return isWindows ? wrapperPath : `./gradlew`;
        }

        // Fall back to global gradle command
        return 'gradle';
    }

    private getTaskGroup(groupName: string): vscode.TaskGroup {
        switch (groupName.toLowerCase()) {
            case 'build':
                return vscode.TaskGroup.Build;
            case 'verification':
            case 'test':
                return vscode.TaskGroup.Test;
            case 'application':
            case 'run':
                return vscode.TaskGroup.Build; // Use Build group for run tasks
            default:
                return vscode.TaskGroup.Build;
        }
    }
}

/**
 * Gradle task definition interface
 */
interface GradleTaskDefinition extends vscode.TaskDefinition {
    task: string;
    args?: string[];
    cwd?: string;
}

/**
 * Register the Gradle task provider
 */
export function registerGradleTaskProvider(context: vscode.ExtensionContext): vscode.Disposable | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const provider = new GradleTaskProvider(workspaceRoot);

    return vscode.tasks.registerTaskProvider(GradleTaskProvider.TYPE, provider);
}