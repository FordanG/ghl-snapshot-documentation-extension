const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const JavaScriptObfuscator = require('javascript-obfuscator');
const { minify } = require('terser');

// Configuration
const SOURCE_DIR = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(__dirname, 'dist');

// Files to process
const JS_FILES = [
  'api-wrapper.js',
  'background.js',
  'bulk-contact-editor.js',
  'contact-field-inspector.js',
  'content-custom-domain.js',
  'content-test.js',
  'content.js',
  'detect-ghl.js',
  'inject.js',
  'license-manager.js',
  'page-exporter.js',
  'popup.js',
  'quick-navigation.js',
  'revex-auth.js',
  'snapshot-exporter.js',
  'workflow-analyzer.js',
  'workflow-viewer.js'
];

// Files/folders to copy as-is
const COPY_ITEMS = [
  'manifest.json',
  'popup.html',
  'popup.css',
  'command-palette.css',
  'simple-popup.css',
  'workflow-viewer.css',
  'xlsx.full.min.js',
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

// Clean and create output directory
if (fs.existsSync(OUTPUT_DIR)) {
  fs.rmSync(OUTPUT_DIR, { recursive: true });
}
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

console.log('🔨 Starting build process...\n');

// Process JavaScript files
console.log('📦 Obfuscating and minifying JavaScript files...');
JS_FILES.forEach(file => {
  const sourcePath = path.join(SOURCE_DIR, file);
  const outputPath = path.join(OUTPUT_DIR, file);

  if (!fs.existsSync(sourcePath)) {
    console.log(`⚠️  Skipping ${file} (not found)`);
    return;
  }

  try {
    const code = fs.readFileSync(sourcePath, 'utf8');

    // First obfuscate
    const obfuscated = JavaScriptObfuscator.obfuscate(code, OBFUSCATOR_OPTIONS);

    // Then minify further
    const minified = minify(obfuscated.getObfuscatedCode(), {
      compress: {
        dead_code: true,
        drop_console: true,
        drop_debugger: true,
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
});

// Copy other files
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
      // Copy directory recursively
      fs.cpSync(sourcePath, outputPath, { recursive: true });
      console.log(`✅ ${item}/ (directory)`);
    } else {
      // Copy file
      fs.copyFileSync(sourcePath, outputPath);
      console.log(`✅ ${item}`);
    }
  } catch (error) {
    console.error(`❌ Error copying ${item}:`, error.message);
  }
});

// Create zip file
console.log('\n📦 Creating distribution zip...');
const archiver = require('archiver');
const zipPath = path.join(__dirname, 'snapshot-ai.zip');
const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`✅ Created ${zipPath}`);
  console.log(`📊 Total size: ${(archive.pointer() / 1024).toFixed(2)} KB`);

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

  console.log('\n✨ Build complete! Your protected extension is ready to distribute.');
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);
archive.directory(OUTPUT_DIR, false);
archive.finalize();
