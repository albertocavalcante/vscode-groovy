import { expect } from 'chai';
import * as sinon from 'sinon';
import proxyquire = require('proxyquire');

// Create vscode mocks
const showInformationMessageStub = sinon.stub();
const showErrorMessageStub = sinon.stub();
const openExternalStub = sinon.stub();
const executeCommandStub = sinon.stub();
const parseStub = sinon.stub();

const vscode = {
    window: {
        showInformationMessage: showInformationMessageStub,
        showErrorMessage: showErrorMessageStub
    },
    env: {
        openExternal: openExternalStub
    },
    commands: {
        executeCommand: executeCommandStub
    },
    Uri: {
        parse: parseStub
    }
};

// Import UpdateNotifier with mocked vscode
const { UpdateNotifier } = proxyquire.noCallThru()('../../../../src/features/update/UpdateNotifier', {
    'vscode': vscode
});

import type { UpdateNotifier as UpdateNotifierType } from '../../../../src/features/update/UpdateNotifier';

describe('UpdateNotifier - Unit Tests', () => {
    let notifier: UpdateNotifierType;

    beforeEach(() => {
        notifier = new UpdateNotifier();
        
        // Reset all stubs
        showInformationMessageStub.reset();
        showErrorMessageStub.reset();
        openExternalStub.reset();
        executeCommandStub.reset();
        parseStub.reset();
        
        // Setup default behavior for Uri.parse
        parseStub.callsFake((url: string) => ({ toString: () => url }));
    });

    describe('showUpdateNotification', () => {
        it('should display notification with correct message format', async () => {
            showInformationMessageStub.resolves(undefined);

            await notifier.showUpdateNotification('0.1.0', '0.2.0', 'https://github.com/test/release');

            expect(showInformationMessageStub.calledOnce).to.be.true;
            const message = showInformationMessageStub.firstCall.args[0] as string;
            expect(message).to.include('0.2.0');
            expect(message).to.include('0.1.0');
            expect(message).to.include('Groovy LSP');
        });

        it('should provide three action buttons', async () => {
            showInformationMessageStub.resolves(undefined);

            await notifier.showUpdateNotification('0.1.0', '0.2.0', 'https://github.com/test/release');

            const buttons = showInformationMessageStub.firstCall.args.slice(1);
            expect(buttons).to.have.lengthOf(3);
            expect(buttons).to.include('Always Update');
            expect(buttons).to.include('Update Once');
            expect(buttons).to.include('Release Notes');
        });

        it('should return "always-update" when Always Update is clicked', async () => {
            showInformationMessageStub.resolves('Always Update');

            const result = await notifier.showUpdateNotification('0.1.0', '0.2.0', 'https://github.com/test/release');

            expect(result).to.equal('always-update');
        });

        it('should return "update-once" when Update Once is clicked', async () => {
            showInformationMessageStub.resolves('Update Once');

            const result = await notifier.showUpdateNotification('0.1.0', '0.2.0', 'https://github.com/test/release');

            expect(result).to.equal('update-once');
        });

        it('should return "release-notes" and open URL when Release Notes is clicked', async () => {
            showInformationMessageStub.resolves('Release Notes');
            openExternalStub.resolves(true);

            const releaseUrl = 'https://github.com/test/release';
            const result = await notifier.showUpdateNotification('0.1.0', '0.2.0', releaseUrl);

            expect(result).to.equal('release-notes');
            expect(openExternalStub.calledOnce).to.be.true;
            
            const uri = openExternalStub.firstCall.args[0];
            expect(uri.toString()).to.equal(releaseUrl);
        });

        it('should return "dismissed" when notification is dismissed', async () => {
            showInformationMessageStub.resolves(undefined);

            const result = await notifier.showUpdateNotification('0.1.0', '0.2.0', 'https://github.com/test/release');

            expect(result).to.equal('dismissed');
        });

        it('should handle different version formats in message', async () => {
            showInformationMessageStub.resolves(undefined);

            await notifier.showUpdateNotification('v1.0.0', 'v2.0.0', 'https://github.com/test/release');

            const message = showInformationMessageStub.firstCall.args[0] as string;
            expect(message).to.include('v2.0.0');
            expect(message).to.include('v1.0.0');
        });
    });

    describe('showAutoUpdateNotification', () => {
        it('should display notification with correct message format', async () => {
            showInformationMessageStub.resolves(undefined);

            await notifier.showAutoUpdateNotification('0.2.0');

            expect(showInformationMessageStub.calledOnce).to.be.true;
            const message = showInformationMessageStub.firstCall.args[0] as string;
            expect(message).to.include('0.2.0');
            expect(message).to.include('automatically updated');
            expect(message).to.include('Restart');
        });

        it('should provide Restart Server button', async () => {
            showInformationMessageStub.resolves(undefined);

            await notifier.showAutoUpdateNotification('0.2.0');

            const buttons = showInformationMessageStub.firstCall.args.slice(1);
            expect(buttons).to.include('Restart Server');
        });

        it('should execute restart command when Restart Server is clicked', async () => {
            showInformationMessageStub.resolves('Restart Server');
            executeCommandStub.resolves();

            await notifier.showAutoUpdateNotification('0.2.0');

            expect(executeCommandStub.calledOnce).to.be.true;
            expect(executeCommandStub.firstCall.args[0]).to.equal('groovy.server.restart');
        });

        it('should not execute restart command when notification is dismissed', async () => {
            showInformationMessageStub.resolves(undefined);

            await notifier.showAutoUpdateNotification('0.2.0');

            expect(executeCommandStub.called).to.be.false;
        });
    });

    describe('showErrorNotification', () => {
        it('should display error message with correct format', async () => {
            showErrorMessageStub.resolves();

            await notifier.showErrorNotification('Network timeout');

            expect(showErrorMessageStub.calledOnce).to.be.true;
            const message = showErrorMessageStub.firstCall.args[0] as string;
            expect(message).to.include('Failed to update');
            expect(message).to.include('Network timeout');
        });

        it('should handle different error messages', async () => {
            showErrorMessageStub.resolves();

            await notifier.showErrorNotification('Checksum mismatch');

            const message = showErrorMessageStub.firstCall.args[0] as string;
            expect(message).to.include('Checksum mismatch');
        });

        it('should handle empty error message', async () => {
            showErrorMessageStub.resolves();

            await notifier.showErrorNotification('');

            expect(showErrorMessageStub.calledOnce).to.be.true;
            const message = showErrorMessageStub.firstCall.args[0] as string;
            expect(message).to.include('Failed to update');
        });
    });

    describe('showUpToDateNotification', () => {
        it('should display notification with correct message format', async () => {
            showInformationMessageStub.resolves();

            await notifier.showUpToDateNotification('0.2.0');

            expect(showInformationMessageStub.calledOnce).to.be.true;
            const message = showInformationMessageStub.firstCall.args[0] as string;
            expect(message).to.include('up to date');
            expect(message).to.include('0.2.0');
        });

        it('should handle different version formats', async () => {
            showInformationMessageStub.resolves();

            await notifier.showUpToDateNotification('v1.5.3');

            const message = showInformationMessageStub.firstCall.args[0] as string;
            expect(message).to.include('v1.5.3');
        });

        it('should not provide any action buttons', async () => {
            showInformationMessageStub.resolves();

            await notifier.showUpToDateNotification('0.2.0');

            // Only the message should be passed, no buttons
            expect(showInformationMessageStub.firstCall.args).to.have.lengthOf(1);
        });
    });

    describe('Message formatting consistency', () => {
        it('should consistently reference "Groovy LSP" in update messages', async () => {
            showInformationMessageStub.resolves(undefined);

            await notifier.showUpdateNotification('0.1.0', '0.2.0', 'https://github.com/test/release');
            await notifier.showAutoUpdateNotification('0.2.0');
            await notifier.showUpToDateNotification('0.2.0');

            const updateMessage = showInformationMessageStub.firstCall.args[0] as string;
            const autoUpdateMessage = showInformationMessageStub.secondCall.args[0] as string;
            const upToDateMessage = showInformationMessageStub.thirdCall.args[0] as string;

            expect(updateMessage).to.include('Groovy LSP');
            expect(autoUpdateMessage).to.include('Groovy LSP');
            expect(upToDateMessage).to.include('Groovy LSP');
        });

        it('should include version information in all relevant messages', async () => {
            showInformationMessageStub.resolves(undefined);

            await notifier.showUpdateNotification('0.1.0', '0.2.0', 'https://github.com/test/release');
            await notifier.showAutoUpdateNotification('0.2.0');
            await notifier.showUpToDateNotification('0.2.0');

            const updateMessage = showInformationMessageStub.firstCall.args[0] as string;
            const autoUpdateMessage = showInformationMessageStub.secondCall.args[0] as string;
            const upToDateMessage = showInformationMessageStub.thirdCall.args[0] as string;

            expect(updateMessage).to.match(/\d+\.\d+\.\d+/);
            expect(autoUpdateMessage).to.match(/\d+\.\d+\.\d+/);
            expect(upToDateMessage).to.match(/\d+\.\d+\.\d+/);
        });
    });
});
