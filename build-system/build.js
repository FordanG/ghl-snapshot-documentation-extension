const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const JavaScriptObfuscator = require('javascript-obfuscator');
const { minify } = require('terser');
const archiver = require('archiver');

// Configuration
const SOURCE_DIR = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(__dirname, 'dist');
const BUILDS_DIR = path.join(__dirname, 'builds');

// Debug mode - set to true to keep console.log statements in the build
const DEBUG = false;

// Generate version string (YYYY-MM-DD-HHMM)
function getVersionString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}-${hours}${minutes}`;
}

const VERSION = getVersionString();

// Files to process (obfuscate and minify)
const JS_FILES = [
  'background.js',
  'inject.js',
  'license-manager.js',
  'page-exporter.js',
  'popup.js',
  'revex-auth.js',
  'snapshot-exporter.js'
];

// Files/folders to copy as-is (no obfuscation)
const COPY_ITEMS = [
  'manifest.json',
  'popup.html',
  'xlsx-js-style.min.js',
  'icons'
];

// Obfuscation settings - aggressive protection
const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: false,
  deadCodeInjectionThreshold: 0,
  debugProtection: false, // Keep false for Chrome extension compatibility
  debugProtectionInterval: 0,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false, // Keep false for Chrome extension compatibility
  selfDefending: false, // Keep false for Chrome extension compatibility
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false
};

// Helper to create zip archive
function createZip(sourceDir, zipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      resolve(archive.pointer());
    });

    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// Copy files to a directory
function copyFiles(destDir, includeJs = true) {
  // Copy JS files
  if (includeJs) {
    JS_FILES.forEach(file => {
      const sourcePath = path.join(SOURCE_DIR, file);
      const outputPath = path.join(destDir, file);
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, outputPath);
      }
    });
  }

  // Copy other items
  COPY_ITEMS.forEach(item => {
    const sourcePath = path.join(SOURCE_DIR, item);
    const outputPath = path.join(destDir, item);
    if (fs.existsSync(sourcePath)) {
      const stats = fs.statSync(sourcePath);
      if (stats.isDirectory()) {
        fs.cpSync(sourcePath, outputPath, { recursive: true });
      } else {
        fs.copyFileSync(sourcePath, outputPath);
      }
    }
  });
}

async function build() {
  console.log(`🔨 Starting build process (version: ${VERSION})...`);
  console.log(`🔧 Debug mode: ${DEBUG ? 'ON (console logs kept)' : 'OFF (console logs removed)'}\n`);

  // Ensure builds directory exists
  if (!fs.existsSync(BUILDS_DIR)) {
    fs.mkdirSync(BUILDS_DIR, { recursive: true });
  }

  // Clean and create output directory for obfuscated build
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Create temporary directory for source build
  const sourceOutputDir = path.join(__dirname, 'dist-source');
  if (fs.existsSync(sourceOutputDir)) {
    fs.rmSync(sourceOutputDir, { recursive: true });
  }
  fs.mkdirSync(sourceOutputDir, { recursive: true });

  // === BUILD 1: Non-obfuscated (source) ===
  console.log('📦 Creating non-obfuscated (source) build...');
  copyFiles(sourceOutputDir, true);

  const sourceZipPath = path.join(BUILDS_DIR, `snapshot-ai-v${VERSION}-source.zip`);
  const sourceSize = await createZip(sourceOutputDir, sourceZipPath);
  console.log(`✅ Created ${path.basename(sourceZipPath)}`);
  console.log(`📊 Source size: ${(sourceSize / 1024).toFixed(2)} KB\n`);

  // === BUILD 2: Obfuscated ===
  console.log('📦 Obfuscating and minifying JavaScript files...');
  for (const file of JS_FILES) {
    const sourcePath = path.join(SOURCE_DIR, file);
    const outputPath = path.join(OUTPUT_DIR, file);

    if (!fs.existsSync(sourcePath)) {
      console.log(`⚠️  Skipping ${file} (not found)`);
      continue;
    }

    try {
      let code = fs.readFileSync(sourcePath, 'utf8');

      // Step 1: Use terser FIRST to strip console calls (before obfuscation)
      // This is necessary because the obfuscator encodes strings, making terser unable to recognize console calls later
      if (!DEBUG) {
        const stripped = await minify(code, {
          compress: {
            drop_console: true,
            drop_debugger: true,
            passes: 2
          },
          mangle: false,  // Don't mangle yet - just strip console
          format: {
            comments: false
          }
        });
        if (stripped.code) {
          code = stripped.code;
        }
      }

      // Step 2: Obfuscate the console-stripped code
      const obfuscated = JavaScriptObfuscator.obfuscate(code, OBFUSCATOR_OPTIONS);

      // Step 3: Final minification pass
      const minified = await minify(obfuscated.getObfuscatedCode(), {
        compress: {
          dead_code: true,
          keep_classnames: false,
          keep_fnames: false
        },
        mangle: {
          toplevel: false
        }
      });

      fs.writeFileSync(outputPath, minified.code || obfuscated.getObfuscatedCode());
      console.log(`✅ ${file}`);
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  }

  // Copy other files for obfuscated build
  console.log('\n📋 Copying other files...');
  COPY_ITEMS.forEach(item => {
    const sourcePath = path.join(SOURCE_DIR, item);
    const outputPath = path.join(OUTPUT_DIR, item);

    if (!fs.existsSync(sourcePath)) {
      console.log(`⚠️  Skipping ${item} (not found)`);
      return;
    }

    try {
      const stats = fs.statSync(sourcePath);

      if (stats.isDirectory()) {
        fs.cpSync(sourcePath, outputPath, { recursive: true });
        console.log(`✅ ${item}/ (directory)`);
      } else {
        fs.copyFileSync(sourcePath, outputPath);
        console.log(`✅ ${item}`);
      }
    } catch (error) {
      console.error(`❌ Error copying ${item}:`, error.message);
    }
  });

  // Create obfuscated zip
  console.log('\n📦 Creating obfuscated distribution zip...');
  const obfuscatedZipPath = path.join(BUILDS_DIR, `snapshot-ai-v${VERSION}.zip`);
  const obfuscatedSize = await createZip(OUTPUT_DIR, obfuscatedZipPath);
  console.log(`✅ Created ${path.basename(obfuscatedZipPath)}`);
  console.log(`📊 Obfuscated size: ${(obfuscatedSize / 1024).toFixed(2)} KB`);

  // Also copy to root for backwards compatibility
  fs.copyFileSync(obfuscatedZipPath, path.join(__dirname, 'snapshot-ai.zip'));

  // Create CRX file
  console.log('\n📦 Creating CRX file...');
  try {
    const createCrxScript = path.join(__dirname, 'create-crx.sh');
    if (fs.existsSync(createCrxScript)) {
      execSync(`bash "${createCrxScript}"`, { stdio: 'inherit' });
    } else {
      console.log('⚠️  CRX creation script not found, skipping...');
    }
  } catch (error) {
    console.log('⚠️  Failed to create CRX file:', error.message);
  }

  // Clean up temporary source directory
  fs.rmSync(sourceOutputDir, { recursive: true });

  console.log('\n' + '='.repeat(50));
  console.log(`✨ Build complete! Version: ${VERSION}`);
  console.log('='.repeat(50));
  console.log(`\nOutput files in builds/:`);
  console.log(`  📁 snapshot-ai-v${VERSION}.zip (obfuscated)`);
  console.log(`  📁 snapshot-ai-v${VERSION}-source.zip (source)`);
  console.log(`\nLatest build also at:`);
  console.log(`  📁 snapshot-ai.zip`);
  console.log(`  📁 snapshot-ai.crx`);
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
