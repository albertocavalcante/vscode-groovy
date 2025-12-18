/**
 * GitHub token resolution utilities.
 * Resolves authentication token from environment variables or gh CLI.
 */

const { spawnSync } = require("node:child_process");

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
  try {
    const result = spawnSync("gh", ["auth", "token"], {
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
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "github.com" &&
      parsed.pathname.includes("/actions/runs/") &&
      parsed.pathname.includes("/artifacts/")
    );
  } catch {
    return false;
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
  const parsed = new URL(browserUrl);
  const pathParts = parsed.pathname.split("/").filter(Boolean);

  // Expected: [owner, repo, 'actions', 'runs', run_id, 'artifacts', artifact_id]
  const ownerIndex = 0;
  const repoIndex = 1;
  const artifactIdIndex = pathParts.indexOf("artifacts") + 1;

  if (artifactIdIndex < 1 || artifactIdIndex >= pathParts.length) {
    throw new Error(`Invalid GitHub artifact URL format: ${browserUrl}`);
  }

  const owner = pathParts[ownerIndex];
  const repo = pathParts[repoIndex];
  const artifactId = pathParts[artifactIdIndex];

  return `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`;
}

module.exports = {
  resolveGitHubToken,
  requiresGitHubAuth,
  isGitHubArtifactUrl,
  transformArtifactUrl,
};
