import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        const extension = vscode.extensions.getExtension('albertocavalcante.vscode-groovy');
        assert.ok(extension, 'Extension should be found');
    });

    test('Extension should activate', async () => {
        const extension = vscode.extensions.getExtension('albertocavalcante.vscode-groovy');
        if (extension) {
            await extension.activate();
            assert.ok(extension.isActive, 'Extension should be active');
        }
    });

    test('Should register all Groovy commands', async () => {
        const commands = await vscode.commands.getCommands(true);

        // Core commands
        assert.ok(commands.includes('groovy.restartServer'), 'Should register restart server command');
        assert.ok(commands.includes('groovy.checkForUpdates'), 'Should register check for updates command');

        // Gradle commands
        assert.ok(commands.includes('groovy.gradle.build'), 'Should register gradle build command');
        assert.ok(commands.includes('groovy.gradle.test'), 'Should register gradle test command');
        assert.ok(commands.includes('groovy.gradle.clean'), 'Should register gradle clean command');

        // Test commands (Not implemented yet)
        // assert.ok(commands.includes('groovy.test.runAll'), 'Should register run all tests command');
        // assert.ok(commands.includes('groovy.test.runCurrentFile'), 'Should register run tests in file command');
    });

    test('Should recognize Groovy language', async () => {
        const languages = await vscode.languages.getLanguages();
        assert.ok(languages.includes('groovy'), 'Should recognize groovy language');
    });

    test('Configuration should have correct structure', () => {
        const config = vscode.workspace.getConfiguration('groovy');
        assert.doesNotThrow(() => config.get('java.home'), 'Should have java.home configuration');
        assert.doesNotThrow(() => config.get('trace.server'), 'Should have trace.server configuration');
        assert.doesNotThrow(() => config.get('compilation.mode'), 'Should have compilation.mode configuration');
    });
});
