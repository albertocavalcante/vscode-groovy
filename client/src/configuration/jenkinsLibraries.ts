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

    return libraries
        .filter(lib => lib.name && lib.name.trim() !== '' && lib.url && lib.url.trim() !== '')
        .map(lib => ({
            name: lib.name!.trim(),
            url: lib.url!.trim(),
            branch: lib.branch?.trim() || 'main'
        }));
}
