import { workspace } from 'vscode';

/**
 * Interface for Jenkins Shared Library configuration
 */
export interface JenkinsLibraryConfig {
    name: string;
    url: string;
    branch: string;
}

/**
 * Gets the Jenkins shared libraries configuration
 */
export function getJenkinsLibrariesConfiguration(): JenkinsLibraryConfig[] {
    const config = workspace.getConfiguration();
    const libraries = config.get<Array<Partial<JenkinsLibraryConfig>>>('jenkins.sharedLibraries');

    if (!libraries || !Array.isArray(libraries)) {
        return [];
    }

    return libraries.map(lib => ({
        name: lib.name || '',
        url: lib.url || '',
        branch: lib.branch || 'master'
    }));
}
