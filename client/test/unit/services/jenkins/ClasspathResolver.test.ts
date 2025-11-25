import { expect } from 'chai';
import * as sinon from 'sinon';
import proxyquire = require('proxyquire');
import type { ClasspathResolver as ClasspathResolverType } from '../../../../src/services/jenkins/ClasspathResolver';

describe('ClasspathResolver', () => {
    let mockFs: any;
    let ClasspathResolver: typeof ClasspathResolverType;
    let resolver: ClasspathResolverType;
    let globalStoragePath: string;

    beforeEach(() => {
        // Mock fs
        mockFs = {
            existsSync: sinon.stub()
        };

        // Load ClasspathResolver with mocks
        const module = proxyquire.noCallThru()('../../../../src/services/jenkins/ClasspathResolver', {
            'fs': mockFs
        });

        ClasspathResolver = module.ClasspathResolver;
        globalStoragePath = '/mock/global/storage';
        resolver = new ClasspathResolver(globalStoragePath);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('resolveClasspaths', () => {
        it('should return paths for src and vars when both exist', () => {
            const libraries = [
                { name: 'lib1', url: 'https://github.com/org/lib1.git', branch: 'main' }
            ];

            mockFs.existsSync.callsFake((path: string) => {
                return path.includes('lib1/src') || path.includes('lib1/vars');
            });

            const paths = resolver.resolveClasspaths(libraries);

            expect(paths).to.have.lengthOf(2);
            expect(paths[0]).to.include('lib1').and.to.include('src');
            expect(paths[1]).to.include('lib1').and.to.include('vars');
        });

        it('should only return src path when vars folder does not exist', () => {
            const libraries = [
                { name: 'lib1', url: 'https://github.com/org/lib1.git', branch: 'main' }
            ];

            mockFs.existsSync.callsFake((path: string) => {
                return path.includes('lib1/src');
            });

            const paths = resolver.resolveClasspaths(libraries);

            expect(paths).to.have.lengthOf(1);
            expect(paths[0]).to.include('lib1').and.to.include('src');
        });

        it('should only return vars path when src folder does not exist', () => {
            const libraries = [
                { name: 'lib1', url: 'https://github.com/org/lib1.git', branch: 'main' }
            ];

            mockFs.existsSync.callsFake((path: string) => {
                return path.includes('lib1/vars');
            });

            const paths = resolver.resolveClasspaths(libraries);

            expect(paths).to.have.lengthOf(1);
            expect(paths[0]).to.include('lib1').and.to.include('vars');
        });

        it('should return empty array when library folder does not exist', () => {
            const libraries = [
                { name: 'lib1', url: 'https://github.com/org/lib1.git', branch: 'main' }
            ];

            mockFs.existsSync.returns(false);

            const paths = resolver.resolveClasspaths(libraries);

            expect(paths).to.be.an('array').that.is.empty;
        });

        it('should handle multiple libraries correctly', () => {
            const libraries = [
                { name: 'lib1', url: 'https://github.com/org/lib1.git', branch: 'main' },
                { name: 'lib2', url: 'https://github.com/org/lib2.git', branch: 'main' }
            ];

            mockFs.existsSync.callsFake((path: string) => {
                // lib1 has both src and vars
                if (path.includes('lib1/src') || path.includes('lib1/vars')) {
                    return true;
                }
                // lib2 has only vars
                if (path.includes('lib2/vars')) {
                    return true;
                }
                return false;
            });

            const paths = resolver.resolveClasspaths(libraries);

            expect(paths).to.have.lengthOf(3);
            // lib1 src and vars
            expect(paths.filter((p: string) => p.includes('lib1'))).to.have.lengthOf(2);
            // lib2 vars only
            expect(paths.filter((p: string) => p.includes('lib2'))).to.have.lengthOf(1);
        });

        it('should return absolute paths', () => {
            const libraries = [
                { name: 'lib1', url: 'https://github.com/org/lib1.git', branch: 'main' }
            ];

            mockFs.existsSync.returns(true);

            const paths = resolver.resolveClasspaths(libraries);

            expect(paths).to.have.lengthOf(2);
            paths.forEach((p: string) => {
                expect(p).to.match(/^[\/\\]|^[a-zA-Z]:[\/\\]/); // Absolute path pattern
            });
        });
    });
});
