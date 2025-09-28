/**
 * Unit tests for configuration settings
 */
import { expect } from 'chai';
import { stub, restore } from 'sinon';
import * as vscode from '../../mocks/vscode';

// Mock vscode module before importing our code
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id: string) {
    if (id === 'vscode') {
        return vscode;
    }
    return originalRequire.apply(this, arguments);
};

import { getConfiguration, affectsConfiguration, affectsJavaConfiguration, affectsCompilationConfiguration } from '../../../src/configuration/settings';

describe('Configuration Settings', () => {
    beforeEach(() => {
        // Reset mocks before each test
        vscode.resetMocks();
    });

    afterEach(() => {
        restore();
    });

    describe('getConfiguration', () => {
        it('should return default configuration values', () => {
            const mockConfig = {
                get: stub().callsFake((key: string, defaultValue?: any) => {
                    switch (key) {
                        case 'java.home': return undefined;
                        case 'trace.server': return defaultValue || 'off';
                        case 'server.maxNumberOfProblems': return defaultValue || 100;
                        case 'compilation.mode': return defaultValue || 'workspace';
                        case 'compilation.incrementalThreshold': return defaultValue || 50;
                        case 'compilation.maxWorkspaceFiles': return defaultValue || 500;
                        case 'server.downloadUrl': return undefined;
                        default: return defaultValue;
                    }
                })
            };

            vscode.workspace.getConfiguration.returns(mockConfig);

            const config = getConfiguration();

            expect(config).to.deep.equal({
                javaHome: undefined,
                traceServer: 'off',
                maxNumberOfProblems: 100,
                compilationMode: 'workspace',
                incrementalThreshold: 50,
                maxWorkspaceFiles: 500,
                serverDownloadUrl: undefined
            });
        });

        it('should return custom configuration values', () => {
            const mockConfig = {
                get: stub().callsFake((key: string, defaultValue?: any) => {
                    switch (key) {
                        case 'java.home': return '/custom/java/path';
                        case 'trace.server': return 'verbose';
                        case 'server.maxNumberOfProblems': return 200;
                        case 'compilation.mode': return 'single-file';
                        case 'compilation.incrementalThreshold': return 25;
                        case 'compilation.maxWorkspaceFiles': return 1000;
                        case 'server.downloadUrl': return undefined;
                        default: return defaultValue;
                    }
                })
            };

            vscode.workspace.getConfiguration.returns(mockConfig);

            const config = getConfiguration();

            expect(config).to.deep.equal({
                javaHome: '/custom/java/path',
                traceServer: 'verbose',
                maxNumberOfProblems: 200,
                compilationMode: 'single-file',
                incrementalThreshold: 25,
                maxWorkspaceFiles: 1000,
                serverDownloadUrl: undefined
            });
        });

        it('should call workspace.getConfiguration with groovy section', () => {
            const mockConfig = { get: stub().returns('default') };
            vscode.workspace.getConfiguration.returns(mockConfig);

            getConfiguration();

            expect(vscode.workspace.getConfiguration.calledWith('groovy')).to.be.true;
        });
    });

    describe('affectsConfiguration', () => {
        it('should return true when configuration section is affected', () => {
            const mockEvent = {
                affectsConfiguration: stub().withArgs('groovy.java.home').returns(true)
            };

            const result = affectsConfiguration(mockEvent as any, 'java.home');

            expect(result).to.be.true;
            expect(mockEvent.affectsConfiguration.calledWith('groovy.java.home')).to.be.true;
        });

        it('should return false when configuration section is not affected', () => {
            const mockEvent = {
                affectsConfiguration: stub().withArgs('groovy.java.home').returns(false)
            };

            const result = affectsConfiguration(mockEvent as any, 'java.home');

            expect(result).to.be.false;
        });
    });

    describe('affectsJavaConfiguration', () => {
        it('should return true when java.home configuration changes', () => {
            const mockEvent = {
                affectsConfiguration: stub().withArgs('groovy.java.home').returns(true)
            };

            const result = affectsJavaConfiguration(mockEvent as any);

            expect(result).to.be.true;
        });

        it('should return false when java.home configuration does not change', () => {
            const mockEvent = {
                affectsConfiguration: stub().withArgs('groovy.java.home').returns(false)
            };

            const result = affectsJavaConfiguration(mockEvent as any);

            expect(result).to.be.false;
        });
    });

    describe('affectsCompilationConfiguration', () => {
        it('should return true when compilation.mode changes', () => {
            const mockEvent = {
                affectsConfiguration: stub().callsFake((section: string) => {
                    return section === 'groovy.compilation.mode';
                })
            };

            const result = affectsCompilationConfiguration(mockEvent as any);

            expect(result).to.be.true;
        });

        it('should return true when compilation.incrementalThreshold changes', () => {
            const mockEvent = {
                affectsConfiguration: stub().callsFake((section: string) => {
                    return section === 'groovy.compilation.incrementalThreshold';
                })
            };

            const result = affectsCompilationConfiguration(mockEvent as any);

            expect(result).to.be.true;
        });

        it('should return true when compilation.maxWorkspaceFiles changes', () => {
            const mockEvent = {
                affectsConfiguration: stub()
                    .withArgs('groovy.compilation.mode').returns(false)
                    .withArgs('groovy.compilation.incrementalThreshold').returns(false)
                    .withArgs('groovy.compilation.maxWorkspaceFiles').returns(true)
            };

            const result = affectsCompilationConfiguration(mockEvent as any);

            expect(result).to.be.true;
        });

        it('should return false when no compilation configuration changes', () => {
            const mockEvent = {
                affectsConfiguration: stub()
                    .withArgs('groovy.compilation.mode').returns(false)
                    .withArgs('groovy.compilation.incrementalThreshold').returns(false)
                    .withArgs('groovy.compilation.maxWorkspaceFiles').returns(false)
            };

            const result = affectsCompilationConfiguration(mockEvent as any);

            expect(result).to.be.false;
        });
    });
});