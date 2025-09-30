import { ExtensionContext, commands, Disposable } from 'vscode';
import { restartClient } from '../server/client';
import { organizeImports, generateAccessors, convertStringType, addCompileStatic } from '../features/codeActions';
import { quickBuild, quickTest, quickClean, selectAndRunTask, showDependencies, refreshProject } from '../features/gradle/commands';
import { GradleUtils } from '../features/gradle/utils';
import { runTestsInFile, runAllTests, runTestAtCursor, discoverTests, createSpockTest } from '../features/testing/commands';

/**
 * Registers all extension commands
 */
export function registerCommands(context: ExtensionContext): Disposable[] {
    const disposables: Disposable[] = [];

    // Register restart server command
    const restartServerCommand = commands.registerCommand('groovy.restartServer', async () => {
        await restartClient();
    });

    // Register code action commands
    const organizeImportsCommand = commands.registerCommand('groovy.organizeImports', organizeImports);
    const generateAccessorsCommand = commands.registerCommand('groovy.generateAccessors', generateAccessors);
    const convertStringCommand = commands.registerCommand('groovy.convertStringType', convertStringType);
    const addCompileStaticCommand = commands.registerCommand('groovy.addCompileStatic', addCompileStatic);

    // Register Gradle commands
    const gradleBuildCommand = commands.registerCommand('groovy.gradle.build', quickBuild);
    const gradleTestCommand = commands.registerCommand('groovy.gradle.test', quickTest);
    const gradleCleanCommand = commands.registerCommand('groovy.gradle.clean', quickClean);
    const gradleSelectTaskCommand = commands.registerCommand('groovy.gradle.selectTask', selectAndRunTask);
    const gradleDependenciesCommand = commands.registerCommand('groovy.gradle.dependencies', showDependencies);
    const gradleRefreshCommand = commands.registerCommand('groovy.gradle.refresh', refreshProject);
    const gradleProjectInfoCommand = commands.registerCommand('groovy.gradle.projectInfo', GradleUtils.showProjectInfo);

    // Register test commands
    const runTestsInFileCommand = commands.registerCommand('groovy.test.runInFile', runTestsInFile);
    const runAllTestsCommand = commands.registerCommand('groovy.test.runAll', runAllTests);
    const runTestAtCursorCommand = commands.registerCommand('groovy.test.runAtCursor', runTestAtCursor);
    const discoverTestsCommand = commands.registerCommand('groovy.test.discover', discoverTests);
    const createSpockTestCommand = commands.registerCommand('groovy.test.createSpock', createSpockTest);

    disposables.push(
        restartServerCommand,
        organizeImportsCommand,
        generateAccessorsCommand,
        convertStringCommand,
        addCompileStaticCommand,
        gradleBuildCommand,
        gradleTestCommand,
        gradleCleanCommand,
        gradleSelectTaskCommand,
        gradleDependenciesCommand,
        gradleRefreshCommand,
        gradleProjectInfoCommand,
        runTestsInFileCommand,
        runAllTestsCommand,
        runTestAtCursorCommand,
        discoverTestsCommand,
        createSpockTestCommand
    );

    // Add all disposables to context subscriptions
    context.subscriptions.push(...disposables);

    return disposables;
}