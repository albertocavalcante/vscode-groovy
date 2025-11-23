const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

// Configuration
// Try to find the local LSP project
const POSSIBLE_LSP_PATHS = [
    process.env.GROOVY_LSP_LOCAL_PATH,
    path.resolve(__dirname, '../../groovy-lsp'),
    path.join(process.env.HOME || '', 'dev', 'workspace', 'groovy-lsp'),
    path.join(process.env.HOME || '', 'workspace', 'groovy-lsp'),
    path.join(process.env.HOME || '', 'projects', 'groovy-lsp')
].filter(Boolean);

const SERVER_DIR = path.resolve(__dirname, '../server');
const TARGET_JAR = path.join(SERVER_DIR, 'groovy-lsp.jar');

function findLspPath() {
    for (const p of POSSIBLE_LSP_PATHS) {
        if (fs.existsSync(p) && fs.existsSync(path.join(p, 'Makefile'))) {
            return p;
        }
    }
    return null;
}

function validateJar(jarPath) {
    try {
        const stats = fs.statSync(jarPath);
        if (stats.size < 10 * 1024) {
            throw new Error(`JAR file is too small (${stats.size} bytes).`);
        }

        const zip = new AdmZip(jarPath);
        const zipEntries = zip.getEntries();
        
        const hasManifest = zipEntries.some(entry => 
            entry.entryName.toUpperCase() === 'META-INF/MANIFEST.MF'
        );

        if (!hasManifest) {
            throw new Error('JAR file is missing META-INF/MANIFEST.MF');
        }

        console.log(`✓ Validated JAR: ${path.basename(jarPath)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        return true;
    } catch (error) {
        throw new Error(`Invalid JAR file: ${error.message}`);
    }
}

const LOCAL_LSP_PATH = findLspPath();

if (!LOCAL_LSP_PATH) {
    console.error('❌ Could not find groovy-lsp project with a Makefile in common locations.');
    process.exit(1);
}

console.log(`📍 Found groovy-lsp project at: ${LOCAL_LSP_PATH}`);

try {
    // 1. Run make jar
    console.log('Running "make jar"...');
    execSync('make jar', { 
        cwd: LOCAL_LSP_PATH, 
        stdio: 'inherit' 
    });
    console.log('✅ Build command completed.');

    // 2. Find the generated JAR
    // Check in the submodule 'groovy-lsp/build/libs' first (standard multi-module pattern)
    let buildLibsDir = path.join(LOCAL_LSP_PATH, 'groovy-lsp', 'build', 'libs');
    
    if (!fs.existsSync(buildLibsDir)) {
        // Fallback to root build/libs
        console.log(`Submodule build dir not found, checking root...`);
        buildLibsDir = path.join(LOCAL_LSP_PATH, 'build', 'libs');
    }

    if (!fs.existsSync(buildLibsDir)) {
        throw new Error(`Build directory not found: ${buildLibsDir}`);
    }

    console.log(`📂 Searching for JARs in: ${buildLibsDir}`);

    // Find the fat jar
    // Prioritize '-all.jar' or '-fat.jar' if available
    const jarFiles = fs.readdirSync(buildLibsDir)
        .filter(file => file.endsWith('.jar') && !file.includes('-sources') && !file.includes('-javadoc'));

    if (jarFiles.length === 0) {
        throw new Error('No JAR files found in build/libs');
    }

    // Sort preference:
    // 1. Files containing '-all' or '-fat'
    // 2. Newer modification time
    const newestJar = jarFiles
        .map(file => ({ 
            file, 
            path: path.join(buildLibsDir, file),
            mtime: fs.statSync(path.join(buildLibsDir, file)).mtime,
            isFat: file.includes('-all') || file.includes('-fat')
        }))
        .sort((a, b) => {
            if (a.isFat && !b.isFat) return -1; // Prefer fat jar
            if (!a.isFat && b.isFat) return 1;
            return b.mtime - a.mtime; // Otherwise prefer newer
        })[0].path;

    console.log(`📦 Found generated JAR: ${newestJar}`);

    // 3. Copy to server directory
    if (!fs.existsSync(SERVER_DIR)) {
        fs.mkdirSync(SERVER_DIR, { recursive: true });
    }

    // Validate source before copying
    console.log('🔍 Validating source JAR...');
    validateJar(newestJar);

    console.log(`📋 Copying to ${TARGET_JAR}...`);
    fs.copyFileSync(newestJar, TARGET_JAR);
    
    // Verify destination
    validateJar(TARGET_JAR);
    
    console.log('🎉 Local LSP build and copy complete!');

} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}