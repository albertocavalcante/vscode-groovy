/**
 * Unit tests for Gradle utilities
 */
import { expect } from 'chai';
import { stub, restore } from 'sinon';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from '../../../mocks/vscode';

// Mock Node.js modules
const mockFs = {
    existsSync: stub(),
    readFileSync: stub()
};

// Mock vscode and fs modules
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id: string) {
    if (id === 'vscode') {
        return vscode;
    }
    if (id === 'fs') {
        return mockFs;
    }
    return originalRequire.apply(this, arguments);
};

import { GradleUtils } from '../../../../src/features/gradle/utils';

describe('GradleUtils', () => {
    beforeEach(() => {
        vscode.resetMocks();
        mockFs.existsSync.reset();
        mockFs.readFileSync.reset();

        // Setup output channel mock for logger
        const outputChannelMock = {
            appendLine: stub(),
            append: stub(),
            show: stub(),
            hide: stub(),
            dispose: stub()
        };
        vscode.window.createOutputChannel.returns(outputChannelMock);
    });

    afterEach(() => {
        restore();
    });

    describe('isGradleProject', () => {
        const mockWorkspaceFolder = {
            uri: { fsPath: '/test/workspace' },
            name: 'test',
            index: 0
        };

        it('should return true when build.gradle exists', () => {
            mockFs.existsSync.callsFake((filePath: string) => {
                return filePath.includes('build.gradle');
            });

            const result = GradleUtils.isGradleProject(mockWorkspaceFolder as any);

            expect(result).to.be.true;
            expect(mockFs.existsSync.calledWith(path.join('/test/workspace', 'build.gradle'))).to.be.true;
        });

        it('should return true when build.gradle.kts exists', () => {
            mockFs.existsSync.callsFake((filePath: string) => {
                return filePath.includes('build.gradle.kts');
            });

            const result = GradleUtils.isGradleProject(mockWorkspaceFolder as any);

            expect(result).to.be.true;
        });

        it('should return true when settings.gradle exists', () => {
            mockFs.existsSync.callsFake((filePath: string) => {
                return filePath.includes('settings.gradle');
            });

            const result = GradleUtils.isGradleProject(mockWorkspaceFolder as any);

            expect(result).to.be.true;
        });

        it('should return false when no Gradle files exist', () => {
            mockFs.existsSync.returns(false);

            const result = GradleUtils.isGradleProject(mockWorkspaceFolder as any);

            expect(result).to.be.false;
        });

        it('should use first workspace folder when none provided', () => {
            vscode.workspace.workspaceFolders = [mockWorkspaceFolder];
            mockFs.existsSync.returns(true);

            const result = GradleUtils.isGradleProject();

            expect(result).to.be.true;
        });

        it('should return false when no workspace folders exist', () => {
            vscode.workspace.workspaceFolders = [];

            const result = GradleUtils.isGradleProject();

            expect(result).to.be.false;
        });
    });

    describe('getGradleCommand', () => {
        const mockWorkspaceFolder = {
            uri: { fsPath: '/test/workspace' },
            name: 'test',
            index: 0
        };

        beforeEach(() => {
            // Reset process.platform mock
            Object.defineProperty(process, 'platform', {
                value: 'linux',
                configurable: true
            });
        });

        it('should return gradlew wrapper command on Unix when wrapper exists', () => {
            mockFs.existsSync.callsFake((filePath: string) => {
                return filePath.includes('gradlew');
            });

            const result = GradleUtils.getGradleCommand(mockWorkspaceFolder as any);

            expect(result).to.equal('./gradlew');
        });

        it('should return gradlew.bat wrapper command on Windows when wrapper exists', () => {
            Object.defineProperty(process, 'platform', {
                value: 'win32',
                configurable: true
            });

            mockFs.existsSync.callsFake((filePath: string) => {
                return filePath.includes('gradlew.bat');
            });

            const result = GradleUtils.getGradleCommand(mockWorkspaceFolder as any);

            expect(result).to.include('gradlew.bat');
        });

        it('should return global gradle command when wrapper does not exist', () => {
            mockFs.existsSync.returns(false);

            const result = GradleUtils.getGradleCommand(mockWorkspaceFolder as any);

            expect(result).to.equal('gradle');
        });

        it('should use first workspace folder when none provided', () => {
            vscode.workspace.workspaceFolders = [mockWorkspaceFolder];
            mockFs.existsSync.returns(false);

            const result = GradleUtils.getGradleCommand();

            expect(result).to.equal('gradle');
        });
    });

    describe('findBuildFiles', () => {
        it('should find build.gradle files in workspace', async () => {
            const mockFiles = [
                { fsPath: '/test/build.gradle', toString: () => 'file:///test/build.gradle' },
                { fsPath: '/test/sub/build.gradle', toString: () => 'file:///test/sub/build.gradle' }
            ];

            vscode.workspace.findFiles.resolves(mockFiles);

            const result = await GradleUtils.findBuildFiles();

            expect(vscode.workspace.findFiles.calledOnce).to.be.true;
            expect(result).to.deep.equal(mockFiles);
        });

        it('should use provided workspace folder', async () => {
            const mockWorkspaceFolder = {
                uri: { fsPath: '/test/workspace' },
                name: 'test',
                index: 0
            };

            vscode.workspace.findFiles.resolves([]);

            await GradleUtils.findBuildFiles(mockWorkspaceFolder as any);

            expect(vscode.workspace.findFiles.calledOnce).to.be.true;
        });
    });

    describe('parseBuildFile', () => {
        const mockBuildFile = {
            fsPath: '/test/build.gradle',
            toString: () => 'file:///test/build.gradle'
        };

        it('should parse plugins from build.gradle', async () => {
            const buildContent = `
                plugins {
                    id 'java'
                    id 'groovy'
                    id 'application' version '1.0'
                }
                apply plugin: 'checkstyle'
            `;

            mockFs.readFileSync.returns(buildContent);

            const result = await GradleUtils.parseBuildFile(mockBuildFile as any);

            expect(result.plugins).to.have.length.greaterThan(0);
            expect(result.plugins.some(p => p.id === 'java')).to.be.true;
            expect(result.plugins.some(p => p.id === 'groovy')).to.be.true;
            expect(result.plugins.some(p => p.id === 'application' && p.version === '1.0')).to.be.true;
            expect(result.plugins.some(p => p.id === 'checkstyle')).to.be.true;
        });

        it('should parse dependencies from build.gradle', async () => {
            const buildContent = `
                dependencies {
                    implementation 'org.apache.groovy:groovy-all:4.0.15'
                    testImplementation 'org.spockframework:spock-core:2.3-groovy-4.0'
                    api 'some.api:library:1.0'
                    compileOnly 'some.annotation:processor:1.0'
                }
            `;

            mockFs.readFileSync.returns(buildContent);

            const result = await GradleUtils.parseBuildFile(mockBuildFile as any);

            expect(result.dependencies).to.have.length(4);
            expect(result.dependencies.some(d =>
                d.configuration === 'implementation' &&
                d.coordinates === 'org.apache.groovy:groovy-all:4.0.15'
            )).to.be.true;
            expect(result.dependencies.some(d =>
                d.configuration === 'testImplementation' &&
                d.coordinates === 'org.spockframework:spock-core:2.3-groovy-4.0'
            )).to.be.true;
        });

        it('should parse custom tasks from build.gradle', async () => {
            const buildContent = `
                task customTask {
                    doLast {
                        println 'Custom task'
                    }
                }

                task('namedTask') {
                    // Named task
                }

                tasks.register('registeredTask') {
                    // Registered task
                }
            `;

            mockFs.readFileSync.returns(buildContent);

            const result = await GradleUtils.parseBuildFile(mockBuildFile as any);

            expect(result.tasks).to.include('customTask');
            expect(result.tasks).to.include('namedTask');
            expect(result.tasks).to.include('registeredTask');
        });

        it('should return empty result when file read fails', async () => {
            mockFs.readFileSync.throws(new Error('File not found'));

            const result = await GradleUtils.parseBuildFile(mockBuildFile as any);

            expect(result).to.deep.equal({
                plugins: [],
                dependencies: [],
                tasks: []
            });
        });
    });
});