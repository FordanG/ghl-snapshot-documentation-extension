# Quick Start Guide - Code Protection

## First Time Setup (Do Once)

```bash
cd build-system
npm install
```

## Every Time You Want to Share

```bash
cd build-system
npm run build
```

That's it! Share the file: **`ghl-utils-protected.zip`**

---

## Simple Workflow

1. **Edit** your code in the main folder
2. **Test** in Chrome (load unpacked extension)
3. **Build**: Run `npm run build` in build-system folder
4. **Share**: Upload `ghl-utils-protected.zip`

---

## What to Share vs Keep Private

### ✅ SHARE THIS:
- `ghl-utils-protected.zip` - Protected version

### ❌ KEEP PRIVATE:
- All original `.js` files
- Your source code directory
- The `build-system/` folder (except README files)

---

## File Locations

```
build-system/
├── ghl-utils-protected.zip  ← SHARE THIS FILE
├── dist/                     ← Protected files inside
├── USAGE-GUIDE.md           ← Full documentation
└── QUICK-START.md           ← This file
```

---

## Common Commands

```bash
# Navigate to build folder
cd build-system

# Build protected version
npm run build

# Rename with version
mv ghl-utils-protected.zip ghl-utils-v1.4.zip

# Check if file was created
ls -lh *.zip
```

---

## Need More Help?

Read **USAGE-GUIDE.md** for:
- Detailed explanations
- Troubleshooting
- Advanced options
- Security best practices

---

## Protection Summary

Your code goes from this:
```javascript
const locationId = getLocationFromURL();
function handleNavigation() {
  // your logic here
}
```

To this:
```javascript
(function(_0x2e1833,_0x3bdba1){const _0x9218e={_0x8991d8:0x3db...
```

Nobody can easily understand or copy your approach!
