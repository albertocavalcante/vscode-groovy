/**
 * Integration tests for extension activation and basic functionality
 */
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
    assert.ok(commands.includes('groovy.organizeImports'), 'Should register organize imports command');
    assert.ok(commands.includes('groovy.generateAccessors'), 'Should register generate accessors command');
    assert.ok(commands.includes('groovy.convertStringType'), 'Should register convert string type command');
    assert.ok(commands.includes('groovy.addCompileStatic'), 'Should register add compile static command');

    // Gradle commands
    assert.ok(commands.includes('groovy.gradle.build'), 'Should register gradle build command');
    assert.ok(commands.includes('groovy.gradle.test'), 'Should register gradle test command');
    assert.ok(commands.includes('groovy.gradle.clean'), 'Should register gradle clean command');
    assert.ok(commands.includes('groovy.gradle.selectTask'), 'Should register gradle select task command');

    // Test commands
    assert.ok(commands.includes('groovy.test.runAll'), 'Should register run all tests command');
    assert.ok(commands.includes('groovy.test.runInFile'), 'Should register run tests in file command');
    assert.ok(commands.includes('groovy.test.createSpock'), 'Should register create spock test command');
  });

  test('Should recognize Groovy language', () => {
    const languages = vscode.languages.getLanguages();
    assert.ok(languages.then(langs => langs.includes('groovy')), 'Should recognize groovy language');
  });

  test('Configuration should have correct structure', () => {
    const config = vscode.workspace.getConfiguration('groovy');

    // Check that configuration sections exist (even if undefined)
    assert.doesNotThrow(() => config.get('java.home'), 'Should have java.home configuration');
    assert.doesNotThrow(() => config.get('trace.server'), 'Should have trace.server configuration');
    assert.doesNotThrow(() => config.get('compilation.mode'), 'Should have compilation.mode configuration');
    assert.doesNotThrow(() => config.get('compilation.incrementalThreshold'), 'Should have compilation.incrementalThreshold configuration');
    assert.doesNotThrow(() => config.get('compilation.maxWorkspaceFiles'), 'Should have compilation.maxWorkspaceFiles configuration');
  });
});