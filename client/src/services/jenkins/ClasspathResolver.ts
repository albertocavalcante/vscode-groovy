import * as fs from 'fs';
import * as path from 'path';
import { JenkinsLibraryConfig } from '../../configuration/jenkinsLibraries';

/**
 * Service for resolving classpaths from Jenkins shared libraries
 */
export class ClasspathResolver {
    private globalStoragePath: string;

    constructor(globalStoragePath: string) {
        this.globalStoragePath = globalStoragePath;
    }

    /**
     * Resolves classpaths for the given libraries
     * Returns an array of absolute paths to src and vars folders
     */
    resolveClasspaths(libraries: JenkinsLibraryConfig[]): string[] {
        const classpaths: string[] = [];

        for (const library of libraries) {
            const libraryPath = path.join(this.globalStoragePath, library.name);

            // Check for src directory
            const srcPath = path.join(libraryPath, 'src');
            if (fs.existsSync(srcPath)) {
                classpaths.push(srcPath);
            }

            // Check for vars directory (global pipeline variables)
            const varsPath = path.join(libraryPath, 'vars');
            if (fs.existsSync(varsPath)) {
                classpaths.push(varsPath);
            }
        }

        return classpaths;
    }
}
