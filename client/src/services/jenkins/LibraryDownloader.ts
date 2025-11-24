import { simpleGit, SimpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';
import { JenkinsLibraryConfig } from '../../configuration/jenkinsLibraries';

/**
 * Service for downloading and managing Jenkins shared libraries
 */
export class LibraryDownloader {
    private globalStoragePath: string;

    constructor(globalStoragePath: string) {
        this.globalStoragePath = globalStoragePath;
    }

    /**
     * Downloads or updates a Jenkins shared library
     */
    async download(library: JenkinsLibraryConfig): Promise<void> {
        const libraryPath = path.join(this.globalStoragePath, library.name);

        try {
            if (!fs.existsSync(libraryPath)) {
                // Clone the repository if it doesn't exist
                await this.cloneRepository(library, libraryPath);
            } else {
                // Update the existing repository
                await this.updateRepository(library, libraryPath);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            if (!fs.existsSync(libraryPath)) {
                throw new Error(`Failed to download library ${library.name}: ${errorMessage}`);
            } else {
                throw new Error(`Failed to update library ${library.name}: ${errorMessage}`);
            }
        }
    }

    /**
     * Clones a git repository
     */
    private async cloneRepository(library: JenkinsLibraryConfig, targetPath: string): Promise<void> {
        const git: SimpleGit = simpleGit();
        await git.clone(library.url, targetPath, { '--branch': library.branch });
    }

    /**
     * Updates an existing git repository
     */
    private async updateRepository(library: JenkinsLibraryConfig, repoPath: string): Promise<void> {
        const git: SimpleGit = simpleGit(repoPath);
        
        // Check current branch
        const branchInfo = await git.branch();
        const currentBranch = branchInfo.current;

        // Checkout the required branch if different
        if (currentBranch !== library.branch) {
            await git.checkout(library.branch);
        }

        // Pull latest changes
        await git.pull();
    }
}
