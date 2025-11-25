import { expect } from 'chai';
import * as sinon from 'sinon';
import proxyquire = require('proxyquire');
import { vscode } from '../mocks/vscode';

// Import the type separately for static analysis
import type { getJenkinsLibrariesConfiguration as getJenkinsLibrariesConfigurationType } from '../../../src/configuration/jenkinsLibraries';

const { getJenkinsLibrariesConfiguration } = proxyquire.noCallThru()('../../../src/configuration/jenkinsLibraries', {
    'vscode': vscode
}) as { getJenkinsLibrariesConfiguration: typeof getJenkinsLibrariesConfigurationType };

describe('JenkinsLibraryConfiguration', () => {
    beforeEach(() => {
        vscode.workspace.getConfiguration.reset();
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should parse Jenkins shared libraries configuration correctly', () => {
        const mockConfig = {
            get: sinon.stub().withArgs('jenkins.sharedLibraries').returns([
                {
                    name: 'my-lib',
                    url: 'https://github.com/org/repo.git',
                    branch: 'main'
                },
                {
                    name: 'another-lib',
                    url: 'https://github.com/org/another.git',
                    branch: 'main'
                }
            ])
        };

        vscode.workspace.getConfiguration.returns(mockConfig);

        const result = getJenkinsLibrariesConfiguration();

        expect(result).to.have.lengthOf(2);
        expect(result[0]).to.deep.equal({
            name: 'my-lib',
            url: 'https://github.com/org/repo.git',
            branch: 'main'
        });
        expect(result[1]).to.deep.equal({
            name: 'another-lib',
            url: 'https://github.com/org/another.git',
            branch: 'main'
        });
    });

    it('should return empty array when no libraries are configured', () => {
        const mockConfig = {
            get: sinon.stub().withArgs('jenkins.sharedLibraries').returns(undefined)
        };

        vscode.workspace.getConfiguration.returns(mockConfig);

        const result = getJenkinsLibrariesConfiguration();

        expect(result).to.be.an('array').that.is.empty;
    });

    it('should use default branch "main" when branch is not specified', () => {
        const mockConfig = {
            get: sinon.stub().withArgs('jenkins.sharedLibraries').returns([
                {
                    name: 'my-lib',
                    url: 'https://github.com/org/repo.git'
                }
            ])
        };

        vscode.workspace.getConfiguration.returns(mockConfig);

        const result = getJenkinsLibrariesConfiguration();

        expect(result).to.have.lengthOf(1);
        expect(result[0].branch).to.equal('main');
    });

    it('should filter out invalid entries with empty name or url', () => {
        const mockConfig = {
            get: sinon.stub().withArgs('jenkins.sharedLibraries').returns([
                {
                    name: 'valid-lib',
                    url: 'https://github.com/org/repo.git',
                    branch: 'main'
                },
                {
                    name: '',
                    url: 'https://github.com/org/repo.git',
                    branch: 'main'
                },
                {
                    name: 'another-lib',
                    url: '',
                    branch: 'main'
                },
                {
                    name: '   ',
                    url: 'https://github.com/org/repo.git',
                    branch: 'main'
                }
            ])
        };

        vscode.workspace.getConfiguration.returns(mockConfig);

        const result = getJenkinsLibrariesConfiguration();

        expect(result).to.have.lengthOf(1);
        expect(result[0].name).to.equal('valid-lib');
    });

    it('should trim whitespace from name, url, and branch', () => {
        const mockConfig = {
            get: sinon.stub().withArgs('jenkins.sharedLibraries').returns([
                {
                    name: '  my-lib  ',
                    url: '  https://github.com/org/repo.git  ',
                    branch: '  develop  '
                }
            ])
        };

        vscode.workspace.getConfiguration.returns(mockConfig);

        const result = getJenkinsLibrariesConfiguration();

        expect(result).to.have.lengthOf(1);
        expect(result[0]).to.deep.equal({
            name: 'my-lib',
            url: 'https://github.com/org/repo.git',
            branch: 'develop'
        });
    });
});
