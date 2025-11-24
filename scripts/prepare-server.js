/**
 * Prepares the Groovy Language Server JAR
 * Priority order:
 * 1. Use existing server/groovy-lsp.jar if present (unless FORCE_DOWNLOAD=true)
 * 2. Copy from local groovy-lsp build if available and PREFER_LOCAL=true
 * 3. Download from GitHub releases
 */

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const SERVER_DIR = path.join(__dirname, '..', 'server');
const CANONICAL_JAR_NAME = 'groovy-lsp.jar';
const JAR_PATH = path.join(SERVER_DIR, CANONICAL_JAR_NAME);
const VERSION_FILE = path.join(SERVER_DIR, '.groovy-lsp-version');

// Pinned Groovy LSP release
const PINNED_RELEASE_TAG = 'v0.2.0';
const PINNED_JAR_ASSET = 'groovy-lsp-0.2.0-linux-amd64.jar';
// v0.2.0 ships a single universal JAR; reuse the linux-amd64 artifact for all platforms
const PINNED_DOWNLOAD_URL = `https://github.com/albertocavalcante/groovy-lsp/releases/download/${PINNED_RELEASE_TAG}/${PINNED_JAR_ASSET}`;

/**
 * Finds local Groovy LSP JAR file in common development locations
 */
function findLocalGroovyLspJar() {
    const searchPaths = [
        // 1. Environment variable override
        process.env.GROOVY_LSP_LOCAL_JAR,

        // 2. Sibling directory (common for development)
        path.join(__dirname, '..', '..', 'groovy-lsp', 'build', 'libs'),

        // 3. Common workspace patterns
        path.join(process.env.HOME || '', 'dev', 'workspace', 'groovy-lsp', 'build', 'libs'),
        path.join(process.env.HOME || '', 'workspace', 'groovy-lsp', 'build', 'libs'),
        path.join(process.env.HOME || '', 'projects', 'groovy-lsp', 'build', 'libs'),
    ].filter(Boolean); // Remove null/undefined paths

    for (const searchPath of searchPaths) {
        try {
            // If it's a direct file path (from env var), check if it exists
            if (searchPath === process.env.GROOVY_LSP_LOCAL_JAR) {
                if (fs.existsSync(searchPath) && searchPath.endsWith('.jar')) {
                    console.log(`Found local JAR via GROOVY_LSP_LOCAL_JAR: ${searchPath}`);
                    return searchPath;
                }
                continue;
            }

            // Otherwise, search for JAR files in the directory
            if (fs.existsSync(searchPath) && fs.statSync(searchPath).isDirectory()) {
                const jarFiles = fs.readdirSync(searchPath)
                    .filter(file => file.endsWith('.jar') && file.includes('groovy-lsp'))
                    .sort(); // Sort to get consistent results

                if (jarFiles.length > 0) {
                    const foundJar = path.join(searchPath, jarFiles[0]); // Use first match
                    console.log(`Found local JAR: ${foundJar}`);
                    return foundJar;
                }
            }
        } catch (error) {
            // Ignore errors for individual paths
            continue;
        }
    }

    console.log('No local Groovy LSP JAR found in common locations');
    return null;
}

/**
 * Downloads a file from URL to local path
 */
function downloadFile(url, filePath) {
    return new Promise((resolve, reject) => {
        function handleRequest(requestUrl) {
            const request = https.get(requestUrl, (response) => {
                // Handle redirects
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    console.log(`Following redirect...`);
                    return handleRequest(response.headers.location);
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }

                // Create file stream only when we have a successful response
                const file = fs.createWriteStream(filePath);

                file.on('error', (error) => {
                    fs.unlink(filePath, () => {}); // Clean up on error
                    reject(error);
                });

                file.on('finish', () => {
                    file.close();
                    resolve();
                });

                response.pipe(file);
            });

            request.on('error', (error) => {
                fs.unlink(filePath, () => {}); // Clean up on error
                reject(error);
            });

            request.setTimeout(60000, () => {
                request.destroy();
                reject(new Error('Download timeout'));
            });
        }

        handleRequest(url);
    });
}

/**
 * Reads version marker stored alongside the server JAR
 */
function readInstalledVersion() {
    try {
        const content = fs.readFileSync(VERSION_FILE, 'utf8').trim();
        return content || null;
    } catch {
        return null;
    }
}

/**
 * Writes version marker for the installed JAR
 */
function writeInstalledVersion(versionTag) {
    fs.writeFileSync(VERSION_FILE, `${versionTag}\n`, 'utf8');
}

/**
 * Downloads the pinned release JAR from GitHub
 */
async function downloadPinnedRelease() {
    console.log(`Downloading Groovy LSP ${PINNED_RELEASE_TAG} (${PINNED_JAR_ASSET})...`);
    await downloadFile(PINNED_DOWNLOAD_URL, JAR_PATH);
    writeInstalledVersion(PINNED_RELEASE_TAG);
    console.log(`✓ Downloaded and saved as ${CANONICAL_JAR_NAME}`);
}

/**
 * Main function to prepare the server JAR
 */
async function prepareServer() {
    try {
        if (process.env.SKIP_PREPARE_SERVER === 'true') {
            console.log('SKIP_PREPARE_SERVER=true, skipping server preparation.');
            return;
        }

        // Ensure server directory exists
        if (!fs.existsSync(SERVER_DIR)) {
            fs.mkdirSync(SERVER_DIR, { recursive: true });
            console.log('Created server directory');
        }

        const forceDownload = process.env.FORCE_DOWNLOAD === 'true';
        const preferLocal = process.env.PREFER_LOCAL === 'true';
        const installedVersion = readInstalledVersion();

        // Try local build first if preferred
        if (preferLocal) {
            const localJarPath = findLocalGroovyLspJar();

            if (localJarPath) {
                let shouldCopy = true;

                if (!forceDownload && fs.existsSync(JAR_PATH)) {
                    // Compare timestamps to see if local build is newer
                    const localStat = fs.statSync(localJarPath);
                    const existingStat = fs.statSync(JAR_PATH);

                    if (localStat.mtime <= existingStat.mtime) {
                        console.log(`✓ Using existing ${CANONICAL_JAR_NAME} (up to date)`);
                        shouldCopy = false;
                    }
                }

                if (shouldCopy) {
                    console.log(`Copying from local build: ${localJarPath}`);
                    fs.copyFileSync(localJarPath, JAR_PATH);
                    writeInstalledVersion('local');
                    console.log(`✓ Copied to ${CANONICAL_JAR_NAME}`);
                }
                return;
            } else {
                console.log('PREFER_LOCAL=true but no local JAR found, falling back to download...');
            }
        }

        const isPinnedJarInstalled = fs.existsSync(JAR_PATH) && installedVersion === PINNED_RELEASE_TAG;

        // Check if pinned JAR already exists (unless force download)
        if (!forceDownload && isPinnedJarInstalled) {
            console.log(`✓ Using existing ${CANONICAL_JAR_NAME} for ${PINNED_RELEASE_TAG}`);
            return;
        }

        // Download from GitHub releases
        console.log('Downloading pinned Groovy LSP release...');
        await downloadPinnedRelease();

    } catch (error) {
        console.error('❌ Error preparing Groovy Language Server:');
        console.error(error.message);

        // Provide helpful error messages
        if (error.message.includes('ENOTFOUND') || error.message.includes('timeout')) {
            console.error('');
            console.error('Network error. Please check your internet connection or try again later.');
        }

        console.error('');
        console.error(`Pinned release: ${PINNED_RELEASE_TAG}`);
        console.error(`Expected asset: ${PINNED_JAR_ASSET}`);
        console.error(`Release page: https://github.com/albertocavalcante/groovy-lsp/releases/tag/${PINNED_RELEASE_TAG}`);
        console.error('');
        console.error('You can also manually copy a JAR file to:');
        console.error(`  ${JAR_PATH}`);

        const requireBundle = process.env.REQUIRE_SERVER_BUNDLE === 'true';
        const ignoreFailure = process.env.IGNORE_DOWNLOAD_FAILURE === 'true';
        const allowCIFallback = !requireBundle && (process.env.CI || process.env.GITHUB_ACTIONS);

        // Allow CI runs (except when REQUIRE_SERVER_BUNDLE=true) to continue without failing installation
        if (!requireBundle && (ignoreFailure || allowCIFallback)) {
            console.warn('\n⚠️ WARNING: Server JAR download failed, but ignoring failure (CI/GITHUB_ACTIONS/IGNORE_DOWNLOAD_FAILURE).');
            console.warn('The extension will NOT work without the server JAR unless a custom path is configured.');
            process.exit(0);
        }

        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    const args = new Set(process.argv.slice(2));

    async function run() {
        if (args.has('--print-release-tag')) {
            process.stdout.write(PINNED_RELEASE_TAG);
            return;
        }

        console.log('Preparing Groovy Language Server...');
        await prepareServer();
        console.log('✅ Server preparation complete!');
    }

    run().catch(error => {
        console.error('Failed to prepare Groovy Language Server:', error);
        process.exit(1);
    }); // NOSONAR: top-level await is not available in this CommonJS entrypoint
}

module.exports = {
    PINNED_RELEASE_TAG
};
