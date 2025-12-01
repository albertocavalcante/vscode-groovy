/**
 * Update checker feature for Groovy Language Server
 * 
 * This module provides automatic version checking and update notifications
 * for the Groovy LSP, with support for airgap mode and automatic updates.
 */

// Public exports will be added as components are implemented
export { UpdateCheckerService } from './UpdateCheckerService';
export { VersionChecker } from './VersionChecker';
export { UpdateNotifier } from './UpdateNotifier';
export { UpdateInstaller } from './UpdateInstaller';
export { VersionCache } from './VersionCache';

// Type exports
export type { UpdateCheckResult, VersionInfo } from './UpdateCheckerService';
export type { ReleaseInfo } from './VersionChecker';
export type { UpdateAction } from './UpdateNotifier';
export type { InstallResult } from './UpdateInstaller';
export type { CachedRelease } from './VersionCache';
