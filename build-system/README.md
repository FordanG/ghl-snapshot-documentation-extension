# GHL Utils - Build System

This build system obfuscates and minifies your Chrome extension code to protect it from being copied.

## What It Does

1. **Obfuscates** all JavaScript files with aggressive protection:
   - Renames variables to hexadecimal values
   - Flattens control flow
   - Injects dead code
   - Encodes strings in base64
   - Transforms object keys
   - Splits strings into chunks

2. **Minifies** code to reduce size and remove any remaining readability

3. **Creates a distributable ZIP** file ready to share

## Installation

```bash
cd build-system
npm install
```

## Usage

```bash
npm run build
```

This will:

- Process all JavaScript files from the parent directory
- Create a `dist/` folder with obfuscated code
- Generate `ghl-utils-protected.zip` ready for distribution

## Output

- `dist/` - Contains the protected extension files
- `snapshot-ai.zip` - Ready-to-share zip file
- `snapshot-ai.crx` - Chrome extension package (with installation warnings)
- `extension-key.pem` - Private key for signing updates (keep this secure!)

## Important Notes

- The obfuscated code will still work exactly the same
- Original source files are NOT modified
- Keep your original source code private
- Only distribute the protected zip file
- Code will be significantly harder to reverse engineer

## Protection Level

The obfuscation settings are configured for high protection while maintaining Chrome extension compatibility:

- Control flow flattening: 75%
- Dead code injection: 40%
- String encoding: Base64
- String array threshold: 75%

This makes the code very difficult to understand, even with debugging tools.

## About CRX Files

The build process automatically generates a `.crx` file, which is a Chrome extension package. However, there are important limitations:

**Important:** Chrome no longer allows one-click installation of CRX files from outside the Chrome Web Store (since 2018). Users will:

- See security warnings when trying to install
- Need to enable "Developer Mode" in Chrome
- May see the extension disabled after installation

**Recommended Distribution Methods:**

1. **Chrome Web Store** (Best option) - True one-click installation, automatic updates
2. **ZIP file** - Users extract and load unpacked in Developer Mode
3. **CRX file** - Only useful for enterprise deployment with policy configuration

The CRX file uses a private key (`extension-key.pem`) for signing. Keep this key secure and don't commit it to version control!
