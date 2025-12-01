# Requirements Document

## Introduction

This feature adds automatic version checking for the Groovy Language Server (LSP) to the VS Code extension. When a new version of the Groovy LSP is available on GitHub releases, the extension will notify users with options to update immediately, always auto-update, or view release notes. The feature includes an "airgap mode" toggle that completely disables all network-based version checking for environments that require strict network isolation.

## Glossary

- **Groovy LSP**: The Groovy Language Server Protocol implementation (`groovy-lsp`) that provides language features like code completion, diagnostics, and navigation.
- **Update Checker**: A background service that periodically checks GitHub releases for newer versions of the Groovy LSP.
- **Airgap Mode**: A configuration setting that completely disables all network-based update checking, suitable for air-gapped or restricted network environments.
- **Installed Version**: The version tag stored in `server/.groovy-lsp-version` representing the currently installed LSP JAR.
- **Latest Release**: The most recent non-prerelease version available on the `groovy-lsp` GitHub repository.
- **Update Notification**: A VS Code information message displayed when a newer LSP version is detected.

## Requirements

### Requirement 1

**User Story:** As a developer, I want to be notified when a new version of the Groovy LSP is available, so that I can benefit from bug fixes and new features.

#### Acceptance Criteria

1. WHEN the extension activates AND airgap mode is disabled THEN the Update_Checker SHALL query the GitHub releases API for the latest Groovy LSP version within 30 seconds of activation (implementation uses 5-second delay to avoid blocking activation).
2. WHEN the latest release version is newer than the installed version THEN the Update_Checker SHALL display an information notification with the new version number.
3. WHEN displaying an update notification THEN the Update_Checker SHALL provide "Always Update", "Update Once", and "Release Notes" action buttons.
4. WHEN the user dismisses the notification without selecting an action THEN the Update_Checker SHALL not perform any update and SHALL check again on next activation.

### Requirement 2

**User Story:** As a developer, I want to update the Groovy LSP with a single click, so that I can quickly get the latest version without manual steps.

#### Acceptance Criteria

1. WHEN the user clicks "Update Once" THEN the Update_Checker SHALL download and install the latest Groovy LSP JAR.
2. WHEN the user clicks "Always Update" THEN the Update_Checker SHALL enable automatic updates in settings AND download and install the latest Groovy LSP JAR.
3. WHEN an update is successfully installed THEN the Update_Checker SHALL prompt the user to restart the language server.
4. WHEN an update download fails THEN the Update_Checker SHALL display an error message with the failure reason.

### Requirement 3

**User Story:** As a developer, I want to view release notes before updating, so that I can understand what changes are included in the new version.

#### Acceptance Criteria

1. WHEN the user clicks "Release Notes" THEN the Update_Checker SHALL open the GitHub release page for the new version in the default browser.

### Requirement 4

**User Story:** As a developer in a restricted network environment, I want to completely disable update checking, so that the extension does not attempt any network requests for version checking.

#### Acceptance Criteria

1. WHEN airgap mode is enabled in settings THEN the Update_Checker SHALL not make any network requests to check for updates.
2. WHEN airgap mode is enabled THEN the Update_Checker SHALL not display any update-related notifications.
3. WHEN airgap mode is toggled from disabled to enabled THEN the Update_Checker SHALL immediately stop any pending update checks.
4. WHEN airgap mode is toggled from enabled to disabled THEN the Update_Checker SHALL perform an update check within 30 seconds.

### Requirement 5

**User Story:** As a developer, I want to configure automatic updates, so that I can choose whether updates happen automatically or require my approval.

#### Acceptance Criteria

1. WHEN automatic updates are enabled AND a new version is detected THEN the Update_Checker SHALL automatically download and install the update without prompting.
2. WHEN automatic updates are enabled AND an update is installed THEN the Update_Checker SHALL display a notification informing the user that an update was installed.
3. WHEN automatic updates are disabled THEN the Update_Checker SHALL only notify the user about available updates without installing them.

### Requirement 6

**User Story:** As a developer, I want to manually check for updates, so that I can verify I have the latest version at any time.

#### Acceptance Criteria

1. WHEN the user executes the "Check for Updates" command THEN the Update_Checker SHALL immediately query GitHub for the latest version.
2. WHEN a manual check finds a new version THEN the Update_Checker SHALL display the update notification.
3. WHEN a manual check finds no new version THEN the Update_Checker SHALL display a message confirming the installed version is up to date.
4. WHEN a manual check fails due to network error THEN the Update_Checker SHALL display an error message with troubleshooting guidance.

### Requirement 7

**User Story:** As a developer, I want the update checker to respect rate limits and not impact my workflow, so that the extension remains responsive.

#### Acceptance Criteria

1. WHEN checking for updates THEN the Update_Checker SHALL cache the result and not check again for at least 24 hours unless manually triggered.
2. WHEN the GitHub API returns a rate limit error THEN the Update_Checker SHALL gracefully handle the error and retry after the rate limit resets.
3. WHEN performing update checks THEN the Update_Checker SHALL execute checks in the background without blocking extension activation.

### Requirement 8

**User Story:** As a developer, I want to see the current LSP version, so that I can verify which version is installed.

#### Acceptance Criteria

1. WHEN the user executes the "Show Version" command THEN the Update_Checker SHALL display the currently installed Groovy LSP version.
2. WHEN displaying version information THEN the Update_Checker SHALL include both the installed version and the latest available version if known.

### Requirement 9

**User Story:** As a developer, I want update checking to handle version comparison correctly, so that I only receive notifications for genuinely newer versions.

#### Acceptance Criteria

1. WHEN comparing versions THEN the Update_Checker SHALL use semantic versioning rules to determine if the remote version is newer.
2. WHEN the installed version is "local" or unknown THEN the Update_Checker SHALL skip version comparison and not suggest updates.
3. WHEN the installed version matches the latest version THEN the Update_Checker SHALL not display any update notification.
