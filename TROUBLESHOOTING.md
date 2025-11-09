# Troubleshooting Guide

## 401 Unauthorized Error

### Symptoms
```
Error: Request failed with status code 401
GET https://backend.leadconnectorhq.com/snapshots-appengine/snapshot/xxx/get_assets 401 (Unauthorized)
```

### Root Cause
The GHL snapshot API requires specific headers that the standard Revex service doesn't automatically include:
- `channel: APP`
- `source: WEB_USER`
- `version: 2021-07-28`

### Solution Applied

**Version 1.0.0+** includes a fix in `inject.js` that automatically adds these headers for snapshot API calls.

### If You Still Get 401 Errors

#### Step 1: Reload the Extension
1. Go to `chrome://extensions/`
2. Find "GHL Snapshot Export Documentation"
3. Click the reload icon (circular arrow)
4. Refresh the GHL page you're on

#### Step 2: Verify Authentication
1. Make sure you're logged into GoHighLevel
2. Check that you can access the snapshot page normally
3. Try refreshing the GHL page

#### Step 3: Check Browser Console
1. Press F12 to open DevTools
2. Go to Console tab
3. Look for these messages:
   - `[Inject.js] Revex message bridge ready` ✓
   - `[Revex] Ready!` ✓
   - `[Snapshot Exporter] Module loaded` ✓

#### Step 4: Verify Headers Are Being Sent
1. Open DevTools (F12)
2. Go to Network tab
3. Click "Export Current Snapshot"
4. Look for the request to `get_assets`
5. Check Request Headers should include:
   ```
   authorization: Bearer ...
   channel: APP
   source: WEB_USER
   version: 2021-07-28
   ```

#### Step 5: Alternative - Use Direct API Call (Temporary Workaround)

If the extension still doesn't work, you can fetch the data manually:

1. **Open DevTools** (F12) on the GHL snapshot page
2. **Go to Console tab**
3. **Run this code:**

```javascript
// Get your snapshot ID and company ID
const snapshotId = 'uTwVJ3PkF5HRM5oxCpL1'; // Replace with your snapshot ID
const companyId = '3WEvz5mHuGnbYw1odUaF'; // Replace with your company ID

// Fetch the data using the page's axios instance
const response = await fetch(
  `https://backend.leadconnectorhq.com/snapshots-appengine/snapshot/${snapshotId}/get_assets?type=own&companyId=${companyId}`,
  {
    headers: {
      'authorization': 'Bearer ' + localStorage.getItem('auth._token.laravelJWT')?.replace('Bearer ', ''),
      'channel': 'APP',
      'source': 'WEB_USER',
      'version': '2021-07-28'
    }
  }
);

const data = await response.json();

// Download as JSON
const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `snapshot_${snapshotId}_${new Date().toISOString()}.json`;
a.click();
URL.revokeObjectURL(url);

console.log('Snapshot data downloaded!');
```

4. **Convert JSON to CSV** using an online tool like:
   - https://www.convertcsv.com/json-to-csv.htm
   - https://jsonformatter.org/json-to-csv

### Understanding the Error

The 401 error occurs because:

1. **GHL's Snapshot API** is different from the standard Revex API
2. It requires additional headers beyond just the JWT token
3. The standard Revex service doesn't know about these extra headers

**The fix** detects when you're calling the snapshot API and automatically adds the required headers.

### How the Fix Works

In `inject.js` (lines 181-189):

```javascript
// Detect if this is a snapshot API call
const isSnapshotAPI = endpoint.includes('/snapshots-appengine/');

// Add extra headers for snapshot API
const config = isSnapshotAPI ? {
  headers: {
    'channel': 'APP',
    'source': 'WEB_USER',
    'version': '2021-07-28'
  }
} : {};

// Make request with config
response = await revex.get(fullUrl, config);
```

## Other Common Issues

### Extension Icon Not Showing
**Solution:**
1. Check that icons folder exists with all 3 PNG files
2. Icons were copied from GHL Utils
3. If missing, follow CREATE_ICONS.md

### "Revex authentication not available"
**Solution:**
1. Refresh the GHL page
2. Wait for page to fully load
3. Check console for "[Revex] Ready!" message

### "Could not detect snapshot ID"
**Solution:**
1. Ensure URL contains `/snapshot/{id}`
2. Use Manual Entry mode instead
3. Copy snapshot ID from URL

### No CSV Files Downloaded
**Solution:**
1. Check `chrome://downloads/`
2. Disable popup blocker
3. Check download permissions
4. Try a different browser

### Progress Bar Stuck
**Solution:**
1. Check console for errors
2. Refresh page and try again
3. Use smaller snapshot for testing
4. Check network connection

### Multiple Files Don't Download
**Solution:**
1. Browser may block multiple downloads
2. Allow multiple downloads when prompted
3. Check Chrome settings → Downloads
4. Files download sequentially with 500ms delay

## Debug Mode

To see detailed logs:

1. Open DevTools (F12)
2. Go to Console tab
3. Filter by:
   - `[Revex]` - Authentication logs
   - `[Inject.js]` - Page context logs
   - `[Snapshot Exporter]` - Export logs

### Useful Console Commands

Check if Revex is ready:
```javascript
window.ghlUtilsRevex.isReady()
```

Check snapshot exporter is loaded:
```javascript
window.ghlSnapshotExporter
```

Get current snapshot info:
```javascript
await window.ghlSnapshotExporter.getCurrentSnapshotInfo()
```

## Getting Help

If you're still stuck:

1. **Check the console** - Most errors are logged there
2. **Read the README.md** - Comprehensive documentation
3. **Review GETTING_STARTED.md** - Step-by-step guide
4. **Compare with GHL Utils** - Similar authentication pattern

## Version History

### v1.0.0
- Fixed: Added required headers for snapshot API (channel, source, version)
- Fixed: 401 Unauthorized error for snapshot exports
- Added: Detailed error logging

---

**Still having issues?** Open the browser console and share the error messages for better troubleshooting.
