# GHL Utils - Code Protection Usage Guide

## Overview

This build system protects your Chrome extension source code through advanced obfuscation and minification techniques. Use this whenever you want to share your extension publicly while keeping your code and logic protected.

> **Runtime features shipped in the extension** (what actually runs after install) are documented in [README.md → Recent Feature Updates](./README.md#recent-feature-updates). That list covers: tag contact counts derived from Search Contacts, Trigger Links reverse-lookup columns, JSON-first export ordering, and the self-contained HTML dashboard. Rebuild after any source change so the distributed zip includes them.

---

## Quick Start

### First Time Setup

1. **Open Terminal** and navigate to the build-system folder:
   ```bash
   cd /Users/poppo/Projects/GHL\ Utils/ghl-utils-extension/build-system
   ```

2. **Install dependencies** (only needed once):
   ```bash
   npm install
   ```

3. **Run the build**:
   ```bash
   npm run build
   ```

4. **Find your protected file**:
   - Look for `ghl-utils-protected.zip` in the `build-system` folder
   - This is the file you share publicly

---

## How It Works

### Input (Source Files)
The build script reads your original files from the parent directory:
- All JavaScript files (`.js`)
- HTML files (`popup.html`)
- CSS files (`.css`)
- Icons folder
- `manifest.json`

### Process
1. **Obfuscates** all JavaScript files with multiple protection layers
2. **Minifies** to reduce file size
3. **Copies** non-JS files as-is (HTML, CSS, icons, manifest)
4. **Creates** a ZIP file ready for distribution

### Output
- `dist/` folder - Protected extension files
- `ghl-utils-protected.zip` - Distribution package

---

## When to Use

### Use This Build System When:
- Sharing your extension for free
- Posting to forums or communities
- Giving to beta testers
- Publishing publicly
- Want to prevent code theft

### Keep Original Files When:
- Working on development
- Debugging issues
- Adding new features
- Testing locally

---

## Step-by-Step Workflow

### 1. Development Phase
Work on your original files in the main directory:
```
ghl-utils-extension/
├── api-wrapper.js          ← Edit these
├── background.js           ← Edit these
├── popup.js                ← Edit these
└── ... (other files)
```

### 2. Test Your Changes
1. Load the **original** extension in Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the main `ghl-utils-extension` folder
6. Test all features

### 3. Build Protected Version
When ready to share:
```bash
cd build-system
npm run build
```

You'll see output like:
```
🔨 Starting build process...
📦 Obfuscating and minifying JavaScript files...
✅ api-wrapper.js
✅ background.js
✅ popup.js
... (all files)
✨ Build complete!
```

### 4. Verify Protected Version
1. Unzip `ghl-utils-protected.zip` to a temporary folder
2. Load it in Chrome to test
3. Make sure everything works
4. Check the JavaScript files - they should look unreadable

### 5. Distribute
Share only the `ghl-utils-protected.zip` file:
- Upload to your website
- Share on forums
- Send to users
- Post on GitHub releases

---

## File Structure

```
ghl-utils-extension/
├── build-system/                    ← Build tools folder
│   ├── package.json                 ← Dependencies
│   ├── build.js                     ← Build script
│   ├── node_modules/                ← Installed packages
│   ├── dist/                        ← Protected files (generated)
│   │   ├── api-wrapper.js          ← Obfuscated
│   │   ├── background.js           ← Obfuscated
│   │   ├── popup.js                ← Obfuscated
│   │   ├── popup.html              ← Original
│   │   ├── manifest.json           ← Original
│   │   └── icons/                  ← Original
│   ├── ghl-utils-protected.zip     ← SHARE THIS FILE
│   ├── README.md                    ← Technical info
│   └── USAGE-GUIDE.md              ← This file
├── api-wrapper.js                   ← Original (keep private)
├── background.js                    ← Original (keep private)
├── popup.js                         ← Original (keep private)
└── ... (other original files)
```

---

## Important Rules

### DO:
✅ Keep original source files private
✅ Only share `ghl-utils-protected.zip`
✅ Run build after every code change
✅ Test protected version before sharing
✅ Version your releases (v1.3, v1.4, etc.)

### DON'T:
❌ Share original `.js` files
❌ Upload source code to public repos
❌ Skip testing the protected version
❌ Forget to rebuild after changes
❌ Edit files in the `dist/` folder (they get overwritten)

---

## Updating Your Extension

When you make changes:

1. **Edit original files** in the main directory
2. **Test changes** with the original version
3. **Rebuild**:
   ```bash
   cd build-system
   npm run build
   ```
4. **Rename the zip** to include version:
   ```bash
   mv ghl-utils-protected.zip ghl-utils-v1.4-protected.zip
   ```
5. **Share** the new version

---

## Protection Levels Explained

### What Gets Protected:

1. **Variable Names**
   - `locationId` → `_0x3a8bd2`
   - `handleNavigation` → `_0x4c995a`

2. **Function Logic**
   - Control flow scrambled
   - Dead code added
   - Logic flattened

3. **Strings**
   - Encoded in base64
   - Stored in shuffled arrays
   - Decrypted at runtime

4. **Numbers**
   - `100` → `0x64` or `0x1*0x64`
   - Math expressions used

### What Doesn't Change:
- HTML structure
- CSS styles
- Image files
- manifest.json permissions
- Extension functionality

---

## Troubleshooting

### Build Fails
**Problem**: `npm run build` shows errors
**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Extension Doesn't Work After Build
**Problem**: Protected version has bugs
**Solution**:
1. Check browser console for errors
2. The obfuscation might be too aggressive
3. Edit `build.js` and reduce these values:
   - `controlFlowFlatteningThreshold: 0.5` (was 0.75)
   - `deadCodeInjectionThreshold: 0.2` (was 0.4)
4. Rebuild and test

### File Size Too Large
**Problem**: ZIP file is very big
**Solution**:
- This is normal - obfuscation adds code
- Original: ~94KB → Protected: ~679KB
- Users won't notice the difference
- Loading time is still fast

### Can't Find the ZIP File
**Problem**: Where is `ghl-utils-protected.zip`?
**Solution**:
```bash
cd build-system
ls -lh *.zip
```
It should be in the `build-system` folder

---

## Version Management

Keep track of your releases:

```bash
# After building, rename with version number
cd build-system
mv ghl-utils-protected.zip ghl-utils-v1.3-protected.zip

# Create a releases folder
mkdir -p releases
mv ghl-utils-v1.3-protected.zip releases/

# Document the release
echo "v1.3 - $(date) - Added workflow analyzer feature" >> releases/CHANGELOG.txt
```

---

## Advanced Options

### Customize Protection Level

Edit `build.js` if you need to adjust protection:

```javascript
// Less aggressive (faster, larger files, easier to read)
controlFlowFlatteningThreshold: 0.5,
deadCodeInjectionThreshold: 0.2,
stringArrayThreshold: 0.5,

// More aggressive (slower, harder to read)
controlFlowFlatteningThreshold: 0.9,
deadCodeInjectionThreshold: 0.6,
stringArrayThreshold: 0.9,
```

After editing, rebuild:
```bash
npm run build
```

### Exclude Files from Obfuscation

If a specific file causes issues, edit `build.js`:

```javascript
// Find this array
const JS_FILES = [
  'api-wrapper.js',
  'background.js',
  // 'problematic-file.js',  // Comment out to skip
  'popup.js',
  // ... rest
];
```

### Build Without ZIP

If you just want the `dist/` folder:

```javascript
// Comment out the zip creation section in build.js
// Or manually use the dist folder
```

---

## Security Notes

### What This Protects Against:
✅ Casual code copying
✅ Understanding your algorithms
✅ Stealing your approach
✅ Quick modifications by others
✅ Direct code theft

### What This Doesn't Protect:
❌ Determined reverse engineering
❌ Browser DevTools debugging
❌ Network request inspection
❌ Runtime memory analysis

### Best Practices:
1. Never include API keys in source code
2. Keep sensitive logic server-side
3. Use environment variables for secrets
4. Don't trust client-side validation
5. Always have server-side checks

---

## FAQ

**Q: Do I need to rebuild every time I make changes?**
A: Yes, the protected version won't update automatically.

**Q: Will this slow down my extension?**
A: Slightly, but users won't notice. The decode overhead is minimal.

**Q: Can people still steal my code?**
A: Determined developers can reverse engineer it, but it's 10x harder and time-consuming.

**Q: Should I use this for production?**
A: Yes, but keep your original source code in a safe place for maintenance.

**Q: Can I obfuscate HTML/CSS?**
A: This script doesn't obfuscate HTML/CSS as it would break functionality. Focus protection on JavaScript logic.

**Q: How do I update just one file?**
A: Edit the original, then rebuild everything. The build is fast (a few seconds).

---

## Getting Help

If you run into issues:

1. Check the console output for error messages
2. Verify all original files exist in the parent directory
3. Make sure Node.js and npm are installed
4. Try a clean install: `rm -rf node_modules && npm install`
5. Test the original version first to isolate obfuscation issues

---

## Summary Checklist

Before sharing your extension:

- [ ] All features tested in original version
- [ ] Ran `npm run build` successfully
- [ ] Protected version tested and works
- [ ] ZIP file renamed with version number
- [ ] Original source files kept private
- [ ] CHANGELOG updated
- [ ] Ready to share `ghl-utils-protected.zip`

---

**Remember**: The goal is to make your code hard to understand and copy, not impossible. Combined with good security practices, this provides strong protection for free/public distributions.
