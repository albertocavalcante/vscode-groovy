import { expect } from 'chai';
import * as fc from 'fast-check';
import { VersionChecker } from '../../../../src/features/update/VersionChecker';

describe('VersionChecker - Property-Based Tests', () => {
    let versionChecker: VersionChecker;

    beforeEach(() => {
        versionChecker = new VersionChecker();
    });

    /**
     * Feature: lsp-update-checker, Property 1: Semantic version comparison follows semver rules
     * Validates: Requirements 9.1, 9.3
     */
    describe('Property 1: Semantic version comparison follows semver rules', () => {
        // Generator for valid semantic versions
        const semverArbitrary = fc.tuple(
            fc.nat({ max: 100 }), // major
            fc.nat({ max: 100 }), // minor
            fc.nat({ max: 100 })  // patch
        ).map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

        it('should return 0 when comparing identical versions', () => {
            fc.assert(
                fc.property(semverArbitrary, (version) => {
                    const result = versionChecker.compareVersions(version, version);
                    expect(result).to.equal(0, `Expected ${version} == ${version}`);
                }),
                { numRuns: 100 }
            );
        });

        it('should return positive when first version is greater', () => {
            fc.assert(
                fc.property(
                    fc.tuple(
                        fc.nat({ max: 100 }),
                        fc.nat({ max: 100 }),
                        fc.nat({ max: 100 })
                    ),
                    fc.tuple(
                        fc.nat({ max: 100 }),
                        fc.nat({ max: 100 }),
                        fc.nat({ max: 100 })
                    ),
                    ([major1, minor1, patch1], [major2, minor2, patch2]) => {
                        // Ensure first version is actually greater
                        if (major1 <= major2 && minor1 <= minor2 && patch1 <= patch2) {
                            return true; // Skip this case
                        }

                        const v1 = `${major1}.${minor1}.${patch1}`;
                        const v2 = `${major2}.${minor2}.${patch2}`;

                        // Calculate which should be greater
                        const isV1Greater = 
                            major1 > major2 ||
                            (major1 === major2 && minor1 > minor2) ||
                            (major1 === major2 && minor1 === minor2 && patch1 > patch2);

                        if (!isV1Greater) {
                            return true; // Skip if v1 is not greater
                        }

                        const result = versionChecker.compareVersions(v1, v2);
                        expect(result).to.be.greaterThan(0, `Expected ${v1} > ${v2}`);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should return negative when first version is less', () => {
            fc.assert(
                fc.property(
                    fc.tuple(
                        fc.nat({ max: 100 }),
                        fc.nat({ max: 100 }),
                        fc.nat({ max: 100 })
                    ),
                    fc.tuple(
                        fc.nat({ max: 100 }),
                        fc.nat({ max: 100 }),
                        fc.nat({ max: 100 })
                    ),
                    ([major1, minor1, patch1], [major2, minor2, patch2]) => {
                        const v1 = `${major1}.${minor1}.${patch1}`;
                        const v2 = `${major2}.${minor2}.${patch2}`;

                        // Calculate which should be less
                        const isV1Less = 
                            major1 < major2 ||
                            (major1 === major2 && minor1 < minor2) ||
                            (major1 === major2 && minor1 === minor2 && patch1 < patch2);

                        if (!isV1Less) {
                            return true; // Skip if v1 is not less
                        }

                        const result = versionChecker.compareVersions(v1, v2);
                        expect(result).to.be.lessThan(0, `Expected ${v1} < ${v2}`);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should be transitive: if a > b and b > c, then a > c', () => {
            fc.assert(
                fc.property(
                    semverArbitrary,
                    semverArbitrary,
                    semverArbitrary,
                    (a, b, c) => {
                        const ab = versionChecker.compareVersions(a, b);
                        const bc = versionChecker.compareVersions(b, c);
                        const ac = versionChecker.compareVersions(a, c);

                        // If a > b and b > c, then a > c
                        if (ab > 0 && bc > 0) {
                            expect(ac).to.be.greaterThan(0, 
                                `Transitivity failed: ${a} > ${b} and ${b} > ${c}, but ${a} !> ${c}`);
                        }

                        // If a < b and b < c, then a < c
                        if (ab < 0 && bc < 0) {
                            expect(ac).to.be.lessThan(0,
                                `Transitivity failed: ${a} < ${b} and ${b} < ${c}, but ${a} !< ${c}`);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should handle versions with "v" prefix correctly', () => {
            fc.assert(
                fc.property(semverArbitrary, (version) => {
                    const withV = `v${version}`;
                    const withoutV = version;

                    const result = versionChecker.compareVersions(withV, withoutV);
                    expect(result).to.equal(0, `Expected v${version} == ${version}`);
                }),
                { numRuns: 100 }
            );
        });

        it('should be symmetric: if a == b, then b == a', () => {
            fc.assert(
                fc.property(semverArbitrary, semverArbitrary, (a, b) => {
                    const ab = versionChecker.compareVersions(a, b);
                    const ba = versionChecker.compareVersions(b, a);

                    if (ab === 0) {
                        expect(ba).to.equal(0, `Symmetry failed: ${a} == ${b} but ${b} != ${a}`);
                    } else if (ab > 0) {
                        expect(ba).to.be.lessThan(0, `Symmetry failed: ${a} > ${b} but ${b} !< ${a}`);
                    } else {
                        expect(ba).to.be.greaterThan(0, `Symmetry failed: ${a} < ${b} but ${b} !> ${a}`);
                    }
                }),
                { numRuns: 100 }
            );
        });
    });

    /**
     * Feature: lsp-update-checker, Property 2: Local or unknown versions are never compared
     * Validates: Requirements 9.2
     */
    describe('Property 2: Local or unknown versions are never compared', () => {
        // Generator for invalid/special version strings
        const invalidVersionArbitrary = fc.oneof(
            fc.constant('local'),
            fc.constant('LOCAL'),
            fc.constant('Local'),
            fc.constant('unknown'),
            fc.constant('UNKNOWN'),
            fc.constant('Unknown'),
            fc.constant(''),
            fc.constant('   '),
            fc.constant(null as any),
            fc.constant(undefined as any)
        );

        // Generator for valid semantic versions
        const semverArbitrary = fc.tuple(
            fc.nat({ max: 100 }),
            fc.nat({ max: 100 }),
            fc.nat({ max: 100 })
        ).map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

        it('should return false for isValidVersion with local/unknown versions', () => {
            fc.assert(
                fc.property(invalidVersionArbitrary, (version) => {
                    const result = versionChecker.isValidVersion(version);
                    expect(result).to.be.false;
                }),
                { numRuns: 100 }
            );
        });

        it('should return 0 when comparing any invalid version with any valid version', () => {
            fc.assert(
                fc.property(invalidVersionArbitrary, semverArbitrary, (invalidVersion, validVersion) => {
                    const result1 = versionChecker.compareVersions(invalidVersion, validVersion);
                    const result2 = versionChecker.compareVersions(validVersion, invalidVersion);

                    expect(result1).to.equal(0, 
                        `Expected compareVersions('${invalidVersion}', '${validVersion}') to return 0`);
                    expect(result2).to.equal(0,
                        `Expected compareVersions('${validVersion}', '${invalidVersion}') to return 0`);
                }),
                { numRuns: 100 }
            );
        });

        it('should return 0 when comparing two invalid versions', () => {
            fc.assert(
                fc.property(invalidVersionArbitrary, invalidVersionArbitrary, (v1, v2) => {
                    const result = versionChecker.compareVersions(v1, v2);
                    expect(result).to.equal(0,
                        `Expected compareVersions('${v1}', '${v2}') to return 0`);
                }),
                { numRuns: 100 }
            );
        });

        it('should return true for isValidVersion with valid semver strings', () => {
            fc.assert(
                fc.property(semverArbitrary, (version) => {
                    const result = versionChecker.isValidVersion(version);
                    expect(result).to.be.true;
                }),
                { numRuns: 100 }
            );
        });

        it('should return true for isValidVersion with valid semver strings with "v" prefix', () => {
            fc.assert(
                fc.property(semverArbitrary, (version) => {
                    const withV = `v${version}`;
                    const result = versionChecker.isValidVersion(withV);
                    expect(result).to.be.true;
                }),
                { numRuns: 100 }
            );
        });
    });
});
