# Quick Start - Get It Working NOW

## What Changed

1. ✅ **Reverted to original Revex** - No more bypassing, uses GHL's authentication properly
2. ✅ **Added debugging logs** - Better error messages and console output
3. ✅ **Fixed manual export** - Checks if you're on a GHL page first

## Do This Right Now (3 minutes)

### Step 1: Reload Extension (30 seconds)

```
1. Open: chrome://extensions/
2. Find: "GHL Snapshot Export Documentation"
3. Click: The reload icon (circular arrow) ←
4. Verify: Status shows "Enabled"
```

### Step 2: Navigate to GHL (30 seconds)

```
1. Open new tab: https://app.gohighlevel.com
2. Log in if needed
3. Go to ANY GHL page (dashboard, contacts, anything)
```

### Step 3: Open DevTools (10 seconds)

```
Press F12 (Windows/Linux) or Cmd+Option+I (Mac)
Click "Console" tab
```

### Step 4: Check If Scripts Loaded (1 minute)

In the Console, you should see these messages:

```
[Inject.js] Script started
[Inject.js] Checking localStorage for auth token...
[Inject.js] auth._token.laravelJWT found: true
[Revex] Initializing...
[Revex] Ready!
[Snapshot Exporter] Module loaded
```

**If you DON'T see these:**
- Press Ctrl+R / Cmd+R to refresh the page
- Wait 5 seconds
- Check console again

### Step 5: Test If It's Working (1 minute)

In the Console, paste this and press Enter:

```javascript
// Test if extension loaded
console.log('Revex:', window.ghlUtilsRevex ? '✓ Loaded' : '✗ Not loaded');
console.log('Exporter:', window.ghlSnapshotExporter ? '✓ Loaded' : '✗ Not loaded');
console.log('Revex Ready:', window.ghlUtilsRevex?.isReady() ? '✓ Yes' : '✗ No');
```

**Expected output:**
```
Revex: ✓ Loaded
Exporter: ✓ Loaded
Revex Ready: ✓ Yes
```

### Step 6: Test Manual Export (2 minutes)

Still in Console, paste this:

```javascript
// Your IDs
const snapshotId = 'uTwVJ3PkF5HRM5oxCpL1';
const companyId = '3WEvz5mHuGnbYw1odUaF';

// Test export
window.ghlSnapshotExporter.exportSnapshotWithIds(snapshotId, companyId)
  .then(result => {
    console.log('✅ SUCCESS!', result);
    console.log(`Generated ${result.filesGenerated} CSV files`);
  })
  .catch(error => {
    console.error('❌ FAILED:', error);
  });
```

Watch the console messages and your Downloads folder!

## Expected Console Output

```
[Snapshot Exporter] Message received: exportSnapshotWithIds
[Snapshot Exporter] Starting export with IDs: uTwVJ3PkF5HRM5oxCpL1 3WEvz5mHuGnbYw1odUaF
[Snapshot Exporter] Starting export for snapshot: uTwVJ3PkF5HRM5oxCpL1
[Snapshot Exporter] Waiting for Revex to be ready...
[Snapshot Exporter] Revex is ready
[Snapshot Exporter] Fetching from endpoint: /snapshots-appengine/snapshot/uTwVJ3PkF5HRM5oxCpL1/get_assets?type=own&companyId=3WEvz5mHuGnbYw1odUaF
[Snapshot Exporter] Snapshot data received
[Snapshot Exporter] Generated CSV for Custom_Fields: 155 items
[Snapshot Exporter] Generated CSV for Tags: 100+ items
[Snapshot Exporter] Generated CSV for Workflows: 300+ items
[Snapshot Exporter] Downloaded: Snapshot_uTwVJ3Pk_SUMMARY_2025-10-29T...csv
[Snapshot Exporter] Downloaded: Snapshot_uTwVJ3Pk_Custom_Fields_2025-10-29T...csv
...
[Snapshot Exporter] Export completed successfully
✅ SUCCESS! {filesGenerated: 15}
Generated 15 CSV files
```

## If Step 5 Fails (Scripts Not Loaded)

### Check Extension Status

```
1. Go to: chrome://extensions/
2. Find: "GHL Snapshot Export Documentation"
3. Check for any error messages in red
4. If you see errors, click "Details" → Read the error
```

### Common Error: "Service worker registration failed"

**Fix:**
```
1. Remove the extension
2. Restart Chrome completely
3. Reinstall the extension
4. Navigate to GHL
```

### Common Error: "Could not load script"

**Fix:**
```
1. Check file permissions
2. Make sure all files exist:
   - revex-auth.js
   - inject.js
   - snapshot-exporter.js
3. Reload extension
```

## If Step 6 Fails (Export Fails)

### Error: "Request failed with status code 401"

The 401 error means Revex IS working but the token is wrong/expired.

**Fix:**
```
1. Log out of GHL completely
2. Log back in
3. Navigate to ANY GHL page
4. Wait 10 seconds
5. Try export again
```

### Error: "Revex service not available"

**Fix:**
```
1. Refresh the GHL page
2. Wait longer (10 seconds)
3. Make sure you're on the main GHL app, not a subdomain
```

### Error: "Could not detect snapshot ID"

**Fix:**
This only applies to auto-detect mode. For manual export, this error shouldn't happen because you're providing the IDs directly.

## Using the Extension UI (After Console Test Works)

Once the console test works:

```
1. Click the extension icon in Chrome toolbar
2. Manual Export section:
   - Snapshot ID: uTwVJ3PkF5HRM5oxCpL1
   - Company ID: 3WEvz5mHuGnbYw1odUaF
3. Click "Export with IDs"
4. Watch the progress bar
5. CSV files download!
```

## Debugging Checklist

If it's still not working, check ALL of these:

- [ ] Extension enabled (chrome://extensions/)
- [ ] Extension reloaded (click reload button)
- [ ] On a GHL page (*.gohighlevel.com URL)
- [ ] Page refreshed (Ctrl+R / Cmd+R)
- [ ] Console shows "[Revex] Ready!"
- [ ] Console shows "[Snapshot Exporter] Module loaded"
- [ ] Test in console: `window.ghlUtilsRevex` returns object
- [ ] Test in console: `window.ghlSnapshotExporter` returns object
- [ ] Test in console: `window.ghlUtilsRevex.isReady()` returns `true`
- [ ] Auth token exists: `localStorage.getItem('auth._token.laravelJWT')`

## What We Fixed

### Before (Your Error):
```
❌ "Unable to export. Make sure you are on a GHL page"
❌ Content script not responding
❌ Modified inject.js trying to bypass Revex
```

### After (Now):
```
✅ Original inject.js from GHL Utils (proven to work)
✅ Better error messages showing exact issue
✅ Debugging logs to track what's happening
✅ Manual export checks if you're on GHL page first
```

## The Key Insight

**Revex DOES work correctly!** The original GHL Utils inject.js handles authentication properly, including for snapshot APIs. We don't need to bypass it - we just need to use it as-is.

The error you're seeing now is likely:
1. Scripts not loading (need reload + refresh)
2. Or 401 because token expired (need re-login)

## Need More Help?

See **DEBUG_GUIDE.md** for comprehensive step-by-step debugging.

---

**Bottom line:** Reload extension → Refresh page → Test in console → Should work! 🎯
