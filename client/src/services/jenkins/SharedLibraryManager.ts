import { LanguageClient } from 'vscode-languageclient/node';
import { LibraryDownloader } from './LibraryDownloader';
import { ClasspathResolver } from './ClasspathResolver';
import { getJenkinsLibrariesConfiguration } from '../../configuration/jenkinsLibraries';

/**
 * Manager service that coordinates downloading Jenkins shared libraries
 * and updating the Language Server with classpath information
 */
export class SharedLibraryManager {
    private downloader: LibraryDownloader;
    private resolver: ClasspathResolver;
    private client: LanguageClient;

    constructor(globalStoragePath: string, client: LanguageClient) {
        this.downloader = new LibraryDownloader(globalStoragePath);
        this.resolver = new ClasspathResolver(globalStoragePath);
        this.client = client;
    }

    /**
     * Initializes the shared library manager by downloading libraries
     * and sending classpaths to the Language Server
     */
    async initialize(): Promise<void> {
        const libraries = getJenkinsLibrariesConfiguration();

        if (libraries.length === 0) {
            // Send empty classpath to clear any previously set libraries
            await this.updateClasspaths([]);
            return;
        }

        await this.downloadLibraries(libraries);
        await this.updateClasspaths(libraries);
    }

    /**
     * Refreshes shared libraries (re-downloads and updates classpaths)
     */
    async refresh(): Promise<void> {
        await this.initialize();
    }

    /**
     * Downloads all configured libraries
     */
    private async downloadLibraries(libraries: ReturnType<typeof getJenkinsLibrariesConfiguration>): Promise<void> {
        for (const library of libraries) {
            try {
                await this.downloader.download(library);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                console.error(`Failed to download library ${library.name}: ${message}`);
                // Continue with other libraries
            }
        }
    }

    /**
     * Resolves classpaths and sends them to the Language Server
     */
    private async updateClasspaths(libraries: ReturnType<typeof getJenkinsLibrariesConfiguration>): Promise<void> {
        const classpaths = this.resolver.resolveClasspaths(libraries);

        // Always send notification to ensure server gets updates (including empty array when libraries are removed)
        await this.client.sendNotification('workspace/didChangeConfiguration', {
            settings: {
                externalClasspaths: classpaths
            }
        });
    }
}
