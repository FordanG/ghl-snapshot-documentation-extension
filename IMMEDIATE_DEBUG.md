# Immediate Debug - Script Not Loading

## Error: `Cannot read properties of undefined (reading 'exportSnapshotWithIds')`

This means the content scripts didn't inject into the page.

## Quick Fix - Do This NOW

### Step 1: Check Which Page You're On (10 seconds)

In the Console (F12), run:
```javascript
console.log('Current URL:', window.location.href);
console.log('Is GHL page?', window.location.href.includes('gohighlevel.com'));
```

**You MUST be on:** `*.gohighlevel.com`

### Step 2: Check If Scripts Loaded (20 seconds)

In Console, run:
```javascript
console.log('Revex:', typeof window.ghlUtilsRevex);
console.log('Exporter:', typeof window.ghlSnapshotExporter);
```

**Expected:**
```
Revex: object
Exporter: object
```

**If you see `undefined`:**
- Scripts didn't load → Go to Step 3

### Step 3: Reload Extension + Refresh Page (30 seconds)

```bash
1. Go to: chrome://extensions/
2. Find: "GHL Snapshot Export Documentation"
3. Click the RELOAD button (circular arrow)
4. Go back to your GHL tab
5. Press Ctrl+Shift+R (or Cmd+Shift+R) for hard refresh
6. Wait 5 seconds
7. Try Step 2 again
```

### Step 4: Check Extension Errors (20 seconds)

```bash
1. Go to: chrome://extensions/
2. Find: "GHL Snapshot Export Documentation"
3. Look for red "Errors" button
4. If you see errors, click it and read them
```

**Common errors:**
- "Could not load script" → File missing or path wrong
- "Service worker registration failed" → Extension corrupted

### Step 5: Check Manifest Content Scripts (30 seconds)

The scripts should inject automatically on GHL pages. Let's verify:

In Console on the GHL page:
```javascript
// Check if extension scripts are present
const scripts = Array.from(document.querySelectorAll('script'));
const extScripts = scripts.filter(s => s.src.includes('chrome-extension://'));
console.log('Extension scripts loaded:', extScripts.length);
extScripts.forEach(s => console.log('- ', s.src.split('/').pop()));
```

**You should see:**
```
Extension scripts loaded: 2
-  revex-auth.js
-  snapshot-exporter.js
```

**If you see 0 scripts:**
- Extension isn't injecting → Check manifest.json

## Most Likely Issue: Not on GHL Page

The extension ONLY works on:
- ✅ `https://app.gohighlevel.com/*`
- ✅ `https://*.gohighlevel.com/*`
- ❌ NOT `https://backend.leadconnectorhq.com/*`
- ❌ NOT any other domain

### Solution:
```bash
1. Open a NEW tab
2. Go to: https://app.gohighlevel.com/
3. Log in if needed
4. Navigate to dashboard or ANY page
5. Wait for page to load (5 seconds)
6. Open Console (F12)
7. Check: console.log(window.ghlSnapshotExporter)
```

## Verify Files Exist

In terminal:
```bash
ls -la "/Users/poppo/Projects/snapshot-export-documentation/"
```

**You should see:**
- ✅ manifest.json
- ✅ revex-auth.js
- ✅ inject.js
- ✅ snapshot-exporter.js
- ✅ popup.html
- ✅ popup.js
- ✅ background.js
- ✅ icons/ (folder with 3 PNG files)

**If any missing:** Extension won't load properly

## Check Manifest Content Scripts

Open `manifest.json` and verify:

```json
"content_scripts": [
  {
    "matches": [
      "https://app.gohighlevel.com/*",
      "https://*.gohighlevel.com/*"
    ],
    "js": ["revex-auth.js", "snapshot-exporter.js"],
    "run_at": "document_idle"
  }
]
```

## Full Diagnostic

Run this complete diagnostic in Console:

```javascript
// === EXTENSION DIAGNOSTIC ===
console.log('=== EXTENSION DIAGNOSTIC ===');

// 1. Check URL
console.log('1. URL:', window.location.href);
console.log('   Is GHL?', window.location.href.includes('gohighlevel.com'));

// 2. Check Scripts
console.log('2. Scripts loaded:');
console.log('   - Revex:', typeof window.ghlUtilsRevex);
console.log('   - Exporter:', typeof window.ghlSnapshotExporter);

// 3. Check Extension Scripts
const scripts = Array.from(document.querySelectorAll('script'));
const extScripts = scripts.filter(s => s.src.includes('chrome-extension://'));
console.log('3. Extension scripts:', extScripts.length);
extScripts.forEach(s => console.log('   -', s.src.split('/').pop()));

// 4. Check Revex Status (if available)
if (window.ghlUtilsRevex) {
  console.log('4. Revex ready?', window.ghlUtilsRevex.isReady());
} else {
  console.log('4. Revex: NOT LOADED');
}

// 5. Check localStorage auth
const authToken = localStorage.getItem('auth._token.laravelJWT');
console.log('5. Auth token exists?', !!authToken);

console.log('=== END DIAGNOSTIC ===');
```

**Send me the output!**

## Manual Script Injection (Workaround)

If scripts won't load automatically, try injecting manually:

```javascript
// Load revex-auth.js
const revexScript = document.createElement('script');
revexScript.src = chrome.runtime.getURL('revex-auth.js');
document.head.appendChild(revexScript);

// Wait 1 second, then load snapshot-exporter.js
setTimeout(() => {
  const exporterScript = document.createElement('script');
  exporterScript.src = chrome.runtime.getURL('snapshot-exporter.js');
  document.head.appendChild(exporterScript);
}, 1000);

// Wait 2 seconds, check if loaded
setTimeout(() => {
  console.log('Revex:', typeof window.ghlUtilsRevex);
  console.log('Exporter:', typeof window.ghlSnapshotExporter);
}, 2000);
```

## Nuclear Option: Clean Reinstall

If nothing works:

```bash
1. chrome://extensions/
2. Remove "GHL Snapshot Export Documentation" completely
3. Close ALL Chrome windows
4. Restart Chrome
5. chrome://extensions/
6. Enable Developer mode
7. Load unpacked
8. Select: /Users/poppo/Projects/snapshot-export-documentation
9. Go to: https://app.gohighlevel.com/
10. Wait 10 seconds
11. Open Console (F12)
12. Run: console.log(window.ghlSnapshotExporter)
```

## What Should Happen (Working)

```
Console output when working:
[Inject.js] Script started
[Inject.js] Checking localStorage for auth token...
[Inject.js] auth._token.laravelJWT found: true
[Revex] Initializing...
[Revex] Ready!
[Snapshot Exporter] Module loaded

Then in Console:
> window.ghlSnapshotExporter
{exportSnapshotAssets: ƒ, exportCurrentSnapshot: ƒ, exportSnapshotWithIds: ƒ, getCurrentSnapshotInfo: ƒ}
```

## Expected Timeline

```
0s   - Navigate to GHL page
0s   - Page starts loading
2s   - Page loaded
2s   - Extension scripts inject
3s   - inject.js initializes
3s   - Revex initializes
4s   - Revex ready
4s   - snapshot-exporter.js loads
4s   - window.ghlSnapshotExporter available ✓
```

## Quick Test Script

After reload + refresh, run this:

```javascript
// Wait for scripts to load, then test
setTimeout(() => {
  if (window.ghlSnapshotExporter) {
    console.log('✅ Extension loaded!');
    console.log('Testing company ID fetch...');
    window.ghlUtilsRevex.getLocationId().then(id => {
      console.log('✅ Company ID:', id);
      console.log('Ready to export!');
    });
  } else {
    console.log('❌ Extension NOT loaded');
    console.log('Current URL:', window.location.href);
    console.log('Scripts:', Array.from(document.querySelectorAll('script'))
      .filter(s => s.src.includes('chrome-extension://'))
      .map(s => s.src.split('/').pop()));
  }
}, 5000); // Wait 5 seconds
```

---

## TL;DR - Most Common Issue

**Problem:** Not on a GoHighLevel page
**Solution:** Go to `https://app.gohighlevel.com/` first!

**Problem:** Scripts didn't inject yet
**Solution:** Wait 5 seconds after page load, or refresh page

**Problem:** Extension not loaded
**Solution:** chrome://extensions/ → Reload extension → Refresh GHL page
