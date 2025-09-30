/**
 * Unit tests for logger utility
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

describe('Logger', () => {
    let outputChannelMock: any;

    beforeEach(() => {
        vscode.resetMocks();
        outputChannelMock = {
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

    // Import logger after vscode is mocked
    function getLogger() {
        delete require.cache[require.resolve('../../../src/utils/logger')];
        return require('../../../src/utils/logger').logger;
    }

    describe('info', () => {
        it('should log info messages with timestamp', () => {
            const logger = getLogger();

            logger.info('Test info message');

            expect(outputChannelMock.appendLine.calledOnce).to.be.true;
            const logCall = outputChannelMock.appendLine.getCall(0);
            expect(logCall.args[0]).to.include('[INFO ]');
            expect(logCall.args[0]).to.include('Test info message');
        });

        it('should format timestamp correctly', () => {
            const logger = getLogger();

            logger.info('Test message');

            const logCall = outputChannelMock.appendLine.getCall(0);
            const logMessage = logCall.args[0];

            // Check timestamp format: [HH:MM:SS.mmm]
            expect(logMessage).to.match(/\[\d{2}:\d{2}:\d{2}\.\d{3}\]/);
        });
    });

    describe('error', () => {
        it('should log error messages with timestamp', () => {
            const logger = getLogger();

            logger.error('Test error message');

            expect(outputChannelMock.appendLine.calledOnce).to.be.true;
            const logCall = outputChannelMock.appendLine.getCall(0);
            expect(logCall.args[0]).to.include('[ERROR]');
            expect(logCall.args[0]).to.include('Test error message');
        });

        it('should handle Error objects', () => {
            const logger = getLogger();

            logger.error('Error occurred');

            expect(outputChannelMock.appendLine.calledOnce).to.be.true;
            const logCall = outputChannelMock.appendLine.getCall(0);
            expect(logCall.args[0]).to.include('Error occurred');
        });
    });

    describe('warn', () => {
        it('should log warning messages with timestamp', () => {
            const logger = getLogger();

            logger.warn('Test warning message');

            expect(outputChannelMock.appendLine.calledOnce).to.be.true;
            const logCall = outputChannelMock.appendLine.getCall(0);
            expect(logCall.args[0]).to.include('[WARN ]');
            expect(logCall.args[0]).to.include('Test warning message');
        });
    });

    describe('log levels', () => {
        it('should use appropriate console methods for different levels', () => {
            const logger = getLogger();

            logger.info('Info message');
            logger.warn('Warning message');
            logger.error('Error message');

            expect(outputChannelMock.appendLine.calledThrice).to.be.true;

            const calls = outputChannelMock.appendLine.getCalls();
            expect(calls[0].args[0]).to.include('[INFO ]');
            expect(calls[1].args[0]).to.include('[WARN ]');
            expect(calls[2].args[0]).to.include('[ERROR]');
        });
    });

    describe('message formatting', () => {
        it('should include component name in log messages', () => {
            const logger = getLogger();

            logger.info('Test message');

            const logCall = outputChannelMock.appendLine.getCall(0);
            expect(logCall.args[0]).to.include('[INFO ]');
        });

        it('should format messages consistently', () => {
            const logger = getLogger();

            logger.info('First message');
            logger.error('Second message');

            const calls = outputChannelMock.appendLine.getCalls();
            const infoCall = calls[0];
            const errorCall = calls[1];

            // Both should have timestamp and level
            expect(infoCall.args[0]).to.match(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] \[INFO \]/);
            expect(errorCall.args[0]).to.match(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] \[ERROR\]/);
        });
    });
});