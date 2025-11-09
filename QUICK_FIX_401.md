# Quick Fix for 401 Unauthorized Error

## TL;DR - Just Do This

1. **Reload the extension:**
   - Go to `chrome://extensions/`
   - Click reload button on "GHL Snapshot Export Documentation"

2. **Refresh the GHL page:**
   - Press Ctrl+R (Cmd+R on Mac)
   - Wait for page to fully load

3. **Try export again:**
   - Click extension icon
   - Click "Export Current Snapshot"

## What Was Fixed

The extension now automatically adds these required headers to snapshot API calls:
- `channel: APP`
- `source: WEB_USER`
- `version: 2021-07-28`

## Technical Details

### The Problem
```
GET https://backend.leadconnectorhq.com/snapshots-appengine/snapshot/.../get_assets
Status: 401 Unauthorized
```

GHL's snapshot API requires extra headers beyond the JWT token.

### The Solution
Modified `inject.js` (lines 181-189) to detect snapshot API calls and add required headers:

```javascript
const isSnapshotAPI = endpoint.includes('/snapshots-appengine/');
const config = isSnapshotAPI ? {
  headers: {
    'channel': 'APP',
    'source': 'WEB_USER',
    'version': '2021-07-28'
  }
} : {};
```

### Before Fix
```
revex.get(fullUrl)  // Missing headers → 401 error
```

### After Fix
```
revex.get(fullUrl, config)  // Includes headers → Success!
```

## Verify It's Working

### Method 1: Check Console
1. Open DevTools (F12)
2. Go to Console tab
3. Look for: `[Snapshot Exporter] Snapshot data received` ✓

### Method 2: Check Network
1. Open DevTools (F12)
2. Go to Network tab
3. Click export
4. Find `get_assets` request
5. Status should be `200 OK` or `304 Not Modified` ✓

### Method 3: Check Headers
In Network tab, click the `get_assets` request and verify Request Headers include:
```
authorization: Bearer eyJhbG...
channel: APP
source: WEB_USER
version: 2021-07-28
```

## Still Getting 401?

See **TROUBLESHOOTING.md** for detailed solutions.

Quick checklist:
- [ ] Extension reloaded?
- [ ] Page refreshed?
- [ ] Logged into GHL?
- [ ] On a snapshot page?
- [ ] Console shows "[Revex] Ready!"?

## Alternative: Manual JSON Export

If extension still doesn't work, copy this into browser console:

```javascript
const snapshotId = 'YOUR_SNAPSHOT_ID';
const companyId = 'YOUR_COMPANY_ID';
const token = localStorage.getItem('auth._token.laravelJWT')?.replace('Bearer ', '');

fetch(`https://backend.leadconnectorhq.com/snapshots-appengine/snapshot/${snapshotId}/get_assets?type=own&companyId=${companyId}`, {
  headers: {
    'authorization': 'Bearer ' + token,
    'channel': 'APP',
    'source': 'WEB_USER',
    'version': '2021-07-28'
  }
}).then(r => r.json()).then(data => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `snapshot_${snapshotId}.json`;
  a.click();
});
```

Then convert JSON to CSV online.

---

**Fixed?** Great! Now you can export snapshots without issues.

**Still broken?** Read TROUBLESHOOTING.md for comprehensive solutions.
