/**
 * GitHub token resolution utilities.
 * Resolves authentication token from environment variables or gh CLI.
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function resolveGhCliPath() {
  const explicit = process.env.GH_CLI_PATH;
  if (explicit) {
    return explicit;
  }

  if (process.platform === "win32") {
    const programFiles = process.env.ProgramFiles;
    const programFilesX86 = process.env["ProgramFiles(x86)"];
    const candidates = [
      programFiles ? path.join(programFiles, "GitHub CLI", "gh.exe") : null,
      programFilesX86
        ? path.join(programFilesX86, "GitHub CLI", "gh.exe")
        : null,
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  }

  const candidates = ["/usr/bin/gh", "/usr/local/bin/gh", "/opt/homebrew/bin/gh"];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Resolves GitHub authentication token from various sources.
 * Priority: GH_TOKEN > GITHUB_TOKEN > gh auth token
 *
 * @returns {string|null} Token or null if not available
 */
function resolveGitHubToken() {
  // 1. Explicit env vars (highest priority)
  if (process.env.GH_TOKEN) {
    return process.env.GH_TOKEN;
  }
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  // 2. Try gh CLI auth token (fallback for local dev)
  const ghPath = resolveGhCliPath();
  if (!ghPath) {
    return null;
  }

  try {
    const result = spawnSync(ghPath, ["auth", "token"], {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (result.status === 0 && result.stdout) {
      const token = result.stdout.trim();
      if (token && !token.includes("not logged")) {
        return token;
      }
    }
  } catch {
    // gh CLI not available or failed - ignore
  }

  return null;
}

/**
 * Checks if a URL requires GitHub authentication.
 * @param {string} url - URL to check
 * @returns {boolean}
 */
function requiresGitHubAuth(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // GitHub API always benefits from auth (rate limits)
    if (hostname === "api.github.com") {
      return true;
    }

    // GitHub Actions artifact URLs require auth
    if (
      hostname === "github.com" &&
      parsed.pathname.includes("/actions/") &&
      parsed.pathname.includes("/artifacts/")
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Checks if a URL is a GitHub Actions artifact URL.
 * These URLs need special handling (API transformation, ZIP extraction).
 *
 * @param {string} url - URL to check
 * @returns {boolean}
 */
function isGitHubArtifactUrl(url) {
  return resolveGitHubArtifactDownload(url).isArtifactZip;
}

/**
 * Resolves a GitHub Actions artifact URL (browser or API) into a direct download URL.
 *
 * Browser URL format:
 *   https://github.com/{owner}/{repo}/actions/runs/{run_id}/artifacts/{artifact_id}
 *
 * API URL format:
 *   https://api.github.com/repos/{owner}/{repo}/actions/artifacts/{artifact_id}/zip
 *
 * @param {string} url
 * @returns {{downloadUrl: string, isArtifactZip: boolean, kind: 'browser' | 'api' | null}}
 */
function resolveGitHubArtifactDownload(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "github.com") {
      const match = parsed.pathname.match(
        /^\/([^/]+)\/([^/]+)\/actions\/runs\/\d+\/artifacts\/(\d+)(?:\/.*)?$/,
      );
      if (!match) {
        return { downloadUrl: url, isArtifactZip: false, kind: null };
      }
      const [, owner, repo, artifactId] = match;
      return {
        downloadUrl: `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`,
        isArtifactZip: true,
        kind: "browser",
      };
    }

    if (parsed.hostname === "api.github.com") {
      const match = parsed.pathname.match(
        /^\/repos\/([^/]+)\/([^/]+)\/actions\/artifacts\/(\d+)\/zip$/,
      );
      if (!match) {
        return { downloadUrl: url, isArtifactZip: false, kind: null };
      }

      return { downloadUrl: parsed.toString(), isArtifactZip: true, kind: "api" };
    }

    return { downloadUrl: url, isArtifactZip: false, kind: null };
  } catch {
    return { downloadUrl: url, isArtifactZip: false, kind: null };
  }
}

/**
 * Transforms a GitHub browser artifact URL to an API download URL.
 *
 * Browser URL format:
 *   https://github.com/{owner}/{repo}/actions/runs/{run_id}/artifacts/{artifact_id}
 *
 * API URL format:
 *   https://api.github.com/repos/{owner}/{repo}/actions/artifacts/{artifact_id}/zip
 *
 * @param {string} browserUrl - GitHub browser artifact URL
 * @returns {string} API download URL
 */
function transformArtifactUrl(browserUrl) {
  const { downloadUrl, isArtifactZip, kind } =
    resolveGitHubArtifactDownload(browserUrl);
  if (!isArtifactZip || kind !== "browser") {
    throw new Error(`Invalid GitHub artifact URL format: ${browserUrl}`);
  }
  return downloadUrl;
}

module.exports = {
  resolveGitHubToken,
  resolveGhCliPath,
  requiresGitHubAuth,
  isGitHubArtifactUrl,
  resolveGitHubArtifactDownload,
  transformArtifactUrl,
};
