# Debug Guide - Extension Not Working

## Error: "Unable to export. Make sure you are on a GHL page and refresh if needed."

This means the content script isn't responding. Let's debug step by step.

## Step 1: Verify You're on a GHL Page

The extension only works on GoHighLevel pages (`*.gohighlevel.com`).

**Check your URL:**
```
✓ https://app.gohighlevel.com/...
✓ https://snapshot.gohighlevel.com/...
✗ https://google.com (won't work)
✗ https://leadconnectorhq.com (won't work)
```

## Step 2: Reload Extension

```bash
1. Go to: chrome://extensions/
2. Find: "GHL Snapshot Export Documentation"
3. Click: Reload button (circular arrow)
4. Status should show: "Enabled"
```

## Step 3: Refresh the GHL Page

```bash
1. Go back to your GHL page
2. Press: Ctrl+R (Windows/Linux) or Cmd+R (Mac)
3. Wait for page to fully load (3-5 seconds)
```

## Step 4: Check Console Logs

Open DevTools (F12) → Console tab

### Expected Log Messages

You should see these messages in order:

```
✓ [Inject.js] Script started
✓ [Inject.js] Checking localStorage for auth token...
✓ [Inject.js] auth._token.laravelJWT found: true
✓ [Inject.js] Revex message bridge ready
✓ [Revex] Initializing...
✓ [Revex] Ready!
✓ [Snapshot Exporter] Module loaded
```

### If You DON'T See These Messages

**Content scripts didn't load. Possible causes:**

1. **Extension not enabled**
   - Go to chrome://extensions/
   - Make sure extension toggle is ON

2. **Page loaded before extension**
   - Refresh the page (Ctrl+R / Cmd+R)
   - Wait for full load

3. **Chrome blocked the extension**
   - Check for errors in chrome://extensions/
   - Click "Details" → Check for errors

4. **Wrong page**
   - Must be on *.gohighlevel.com domain

## Step 5: Test Message Passing

In the Console (F12), run this test:

```javascript
// Test if content script is loaded
console.log('Testing...', window.ghlUtilsRevex ? 'Revex loaded ✓' : 'Revex NOT loaded ✗');
console.log('Testing...', window.ghlSnapshotExporter ? 'Exporter loaded ✓' : 'Exporter NOT loaded ✗');
```

**Expected output:**
```
Testing... Revex loaded ✓
Testing... Exporter loaded ✓
```

**If you see "NOT loaded":**
- Extension scripts didn't inject
- Reload extension + refresh page

## Step 6: Test Revex Authentication

In Console, check if Revex is ready:

```javascript
// Check Revex status
window.ghlUtilsRevex.isReady()
```

**Expected:** `true`

**If `false` or error:**
- Revex didn't initialize
- Check auth token exists: `localStorage.getItem('auth._token.laravelJWT')`
- Should return something like: `"Bearer eyJhbGci..."`

## Step 7: Test Manual Export Function

In Console, try manual export directly:

```javascript
// Test export function
window.ghlSnapshotExporter.exportSnapshotWithIds(
  'uTwVJ3PkF5HRM5oxCpL1',  // Your snapshot ID
  '3WEvz5mHuGnbYw1odUaF'   // Your company ID
).then(result => console.log('Success!', result))
  .catch(error => console.error('Failed:', error));
```

Watch the console for progress:
```
[Snapshot Exporter] Starting export...
[Revex] Waiting for Revex to be ready...
[Revex] Revex is ready
[Snapshot Exporter] Fetching from endpoint: /snapshots-appengine/...
[Snapshot Exporter] Snapshot data received
[Snapshot Exporter] Generated CSV for...
...
[Snapshot Exporter] Export completed successfully
```

## Common Issues & Fixes

### Issue 1: "Cannot read property 'isReady' of undefined"

**Cause:** Revex auth script didn't load

**Fix:**
```bash
1. chrome://extensions/ → Reload extension
2. Refresh GHL page
3. Wait 5 seconds
4. Check console for "[Revex] Ready!"
```

### Issue 2: "Revex service not available"

**Cause:** GHL Vue app not found

**Fix:**
- Page might not have loaded completely
- Refresh and wait longer
- Check you're on an actual GHL app page (not login screen)

### Issue 3: "No auth token found"

**Cause:** Not logged into GHL or token expired

**Fix:**
```bash
1. Log out of GHL
2. Log back in
3. Navigate to snapshot page
4. Try export again
```

### Issue 4: "Could not detect snapshot ID"

**Cause:** Not on a snapshot page OR using manual export incorrectly

**Fix:**
- For auto-detect: Must be on `/snapshot/{id}` URL
- For manual: Enter both Snapshot ID and Company ID

### Issue 5: Content script loads but export fails with 401

**Cause:** Revex initialized but API rejected request

**Fix:** See TROUBLESHOOTING.md for 401 errors

## Debugging Checklist

Before asking for help, verify:

- [ ] On a GHL page (*.gohighlevel.com)
- [ ] Extension enabled in chrome://extensions/
- [ ] Extension reloaded
- [ ] GHL page refreshed
- [ ] Console shows "[Revex] Ready!"
- [ ] Console shows "[Snapshot Exporter] Module loaded"
- [ ] `window.ghlUtilsRevex` exists
- [ ] `window.ghlSnapshotExporter` exists
- [ ] `window.ghlUtilsRevex.isReady()` returns `true`
- [ ] Auth token exists: `localStorage.getItem('auth._token.laravelJWT')`

## Advanced Debugging

### Check Extension Injection

In Console:
```javascript
// List all scripts
const scripts = Array.from(document.querySelectorAll('script'));
const extensionScripts = scripts.filter(s => s.src.includes('chrome-extension://'));
console.log('Extension scripts:', extensionScripts.length);
extensionScripts.forEach(s => console.log(s.src));
```

Should see multiple chrome-extension:// URLs for:
- revex-auth.js
- snapshot-exporter.js
- inject.js

### Check Chrome Extension Errors

```bash
1. Go to: chrome://extensions/
2. Find: "GHL Snapshot Export Documentation"
3. Click: "Details"
4. Scroll to: "Inspect views"
5. Click: "service worker"
6. Check for any errors
```

### Network Tab Debugging

1. Open DevTools (F12)
2. Go to Network tab
3. Click export button
4. Look for request to `/snapshots-appengine/...`
5. Check:
   - Status: Should be 200 or 304
   - Request headers: Should include `authorization: Bearer`
   - Response: Should be JSON with snapshot data

## Still Not Working?

If you've tried everything above:

1. **Collect debug info:**
   ```bash
   - Chrome version
   - Extension version
   - URL you're on
   - Console errors (screenshot)
   - Network tab (screenshot)
   ```

2. **Try a clean reinstall:**
   ```bash
   1. Remove extension completely
   2. Restart Chrome
   3. Reinstall extension
   4. Navigate to GHL
   5. Wait 10 seconds
   6. Try export
   ```

3. **Check manifest.json matches:**
   ```bash
   Extension should inject on:
   - "https://app.gohighlevel.com/*"
   - "https://*.gohighlevel.com/*"
   ```

---

## Quick Command Reference

**Check if loaded:**
```javascript
window.ghlUtilsRevex && window.ghlSnapshotExporter
```

**Check if ready:**
```javascript
window.ghlUtilsRevex.isReady()
```

**Get current snapshot info:**
```javascript
await window.ghlSnapshotExporter.getCurrentSnapshotInfo()
```

**Manual export:**
```javascript
await window.ghlSnapshotExporter.exportSnapshotWithIds('SNAPSHOT_ID', 'COMPANY_ID')
```

**Check auth token:**
```javascript
localStorage.getItem('auth._token.laravelJWT')
```
