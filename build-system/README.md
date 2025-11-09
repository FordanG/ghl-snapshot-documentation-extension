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
- `ghl-utils-protected.zip` - Ready-to-share zip file

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
