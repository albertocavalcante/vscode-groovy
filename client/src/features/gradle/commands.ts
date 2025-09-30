import * as vscode from 'vscode';
import { GradleUtils } from './utils';
import { logger } from '../../utils/logger';

/**
 * Quick run Gradle build command
 */
export async function quickBuild(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showWarningMessage('No workspace folder found');
        return;
    }

    if (!GradleUtils.isGradleProject(workspaceFolder)) {
        vscode.window.showWarningMessage('Current workspace is not a Gradle project');
        return;
    }

    try {
        await GradleUtils.runGradleTask('build', workspaceFolder);
        logger.info('Gradle build started');
    } catch (error) {
        logger.error(`Error running Gradle build: ${error}`);
        vscode.window.showErrorMessage('Failed to start Gradle build');
    }
}

/**
 * Quick run Gradle test command
 */
export async function quickTest(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showWarningMessage('No workspace folder found');
        return;
    }

    if (!GradleUtils.isGradleProject(workspaceFolder)) {
        vscode.window.showWarningMessage('Current workspace is not a Gradle project');
        return;
    }

    try {
        await GradleUtils.runGradleTask('test', workspaceFolder);
        logger.info('Gradle test started');
    } catch (error) {
        logger.error(`Error running Gradle test: ${error}`);
        vscode.window.showErrorMessage('Failed to start Gradle test');
    }
}

/**
 * Quick run Gradle clean command
 */
export async function quickClean(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showWarningMessage('No workspace folder found');
        return;
    }

    if (!GradleUtils.isGradleProject(workspaceFolder)) {
        vscode.window.showWarningMessage('Current workspace is not a Gradle project');
        return;
    }

    try {
        await GradleUtils.runGradleTask('clean', workspaceFolder);
        logger.info('Gradle clean started');
    } catch (error) {
        logger.error(`Error running Gradle clean: ${error}`);
        vscode.window.showErrorMessage('Failed to start Gradle clean');
    }
}

/**
 * Select and run any Gradle task
 */
export async function selectAndRunTask(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showWarningMessage('No workspace folder found');
        return;
    }

    if (!GradleUtils.isGradleProject(workspaceFolder)) {
        vscode.window.showWarningMessage('Current workspace is not a Gradle project');
        return;
    }

    try {
        // Get available tasks
        const tasks = await getAvailableTasks(workspaceFolder);

        if (tasks.length === 0) {
            vscode.window.showInformationMessage('No Gradle tasks found');
            return;
        }

        // Show task picker
        const selectedTask = await vscode.window.showQuickPick(tasks, {
            title: 'Select Gradle Task',
            placeHolder: 'Choose a task to run...'
        });

        if (selectedTask) {
            await GradleUtils.runGradleTask(selectedTask.task, workspaceFolder);
            logger.info(`Running Gradle task: ${selectedTask.task}`);
        }
    } catch (error) {
        logger.error(`Error selecting Gradle task: ${error}`);
        vscode.window.showErrorMessage('Failed to load Gradle tasks');
    }
}

/**
 * Show Gradle project dependencies
 */
export async function showDependencies(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showWarningMessage('No workspace folder found');
        return;
    }

    if (!GradleUtils.isGradleProject(workspaceFolder)) {
        vscode.window.showWarningMessage('Current workspace is not a Gradle project');
        return;
    }

    try {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Loading dependencies...',
            cancellable: false
        }, async () => {
            const dependencies = await GradleUtils.getDependencies(workspaceFolder);

            if (dependencies.length === 0) {
                vscode.window.showInformationMessage('No dependencies found');
                return;
            }

            const items: vscode.QuickPickItem[] = dependencies.map(dep => ({
                label: dep,
                description: 'Gradle dependency'
            }));

            await vscode.window.showQuickPick(items, {
                title: `Gradle Dependencies (${dependencies.length})`,
                placeHolder: 'Select a dependency to view details...'
            });
        });
    } catch (error) {
        logger.error(`Error loading dependencies: ${error}`);
        vscode.window.showErrorMessage('Failed to load dependencies');
    }
}

/**
 * Refresh Gradle project
 */
export async function refreshProject(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showWarningMessage('No workspace folder found');
        return;
    }

    if (!GradleUtils.isGradleProject(workspaceFolder)) {
        vscode.window.showWarningMessage('Current workspace is not a Gradle project');
        return;
    }

    try {
        // Run dependencies task to refresh the project
        await GradleUtils.runGradleTask('dependencies', workspaceFolder);

        // Reload VS Code window to refresh language server
        const choice = await vscode.window.showInformationMessage(
            'Gradle project refreshed. Reload window to update language server?',
            'Reload',
            'Later'
        );

        if (choice === 'Reload') {
            await vscode.commands.executeCommand('workbench.action.reloadWindow');
        }

        logger.info('Gradle project refreshed');
    } catch (error) {
        logger.error(`Error refreshing Gradle project: ${error}`);
        vscode.window.showErrorMessage('Failed to refresh Gradle project');
    }
}

// Helper functions

async function getAvailableTasks(workspaceFolder: vscode.WorkspaceFolder): Promise<GradleTaskItem[]> {
    const standardTasks: GradleTaskItem[] = [
        { task: 'build', label: 'build', description: 'Assembles and tests this project', group: 'Build' },
        { task: 'clean', label: 'clean', description: 'Deletes the build directory', group: 'Build' },
        { task: 'assemble', label: 'assemble', description: 'Assembles the outputs of this project', group: 'Build' },
        { task: 'test', label: 'test', description: 'Runs the unit tests', group: 'Verification' },
        { task: 'check', label: 'check', description: 'Runs all checks', group: 'Verification' },
        { task: 'run', label: 'run', description: 'Runs this project as a JVM application', group: 'Application' },
        { task: 'bootRun', label: 'bootRun', description: 'Runs this project as a Spring Boot application', group: 'Application' },
        { task: 'dependencies', label: 'dependencies', description: 'Displays all dependencies', group: 'Help' },
        { task: 'tasks', label: 'tasks', description: 'Displays the tasks runnable from this project', group: 'Help' },
        { task: 'properties', label: 'properties', description: 'Displays the properties of this project', group: 'Help' }
    ];

    // Try to get custom tasks from build files
    try {
        const buildFiles = await GradleUtils.findBuildFiles(workspaceFolder);
        const customTasks: GradleTaskItem[] = [];

        for (const buildFile of buildFiles) {
            const projectInfo = await GradleUtils.parseBuildFile(buildFile);
            for (const taskName of projectInfo.tasks) {
                customTasks.push({
                    task: taskName,
                    label: taskName,
                    description: 'Custom task',
                    group: 'Custom'
                });
            }
        }

        return [...standardTasks, ...customTasks];
    } catch (error) {
        logger.error(`Error loading custom tasks: ${error}`);
        return standardTasks;
    }
}

interface GradleTaskItem extends vscode.QuickPickItem {
    task: string;
    description: string;
    group: string;
}