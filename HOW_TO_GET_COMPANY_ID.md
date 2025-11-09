# How to Get Company ID Through Revex

## TL;DR - In Browser Console

```javascript
// Method 1: From Revex (if available)
await window.ghlUtilsRevex.getLocationId()

// Method 2: From Vue App Context
window.__NUXT__?.data?.[0]?.pageData?.locationId

// Method 3: From URL
window.location.href.match(/\/location\/([A-Za-z0-9_-]+)/)?.[1]

// Method 4: From Chrome Storage (if previously detected)
chrome.storage.local.get(['locationId'], r => console.log(r.locationId))
```

## The Complete Solution

### Already Built Into inject.js!

The `inject.js` file **automatically extracts** the location/company ID from GHL's Vue app:

```javascript
// From inject.js (lines 10-40)
let locationId = null;

// Try Nuxt 3 first
if (typeof useNuxtApp === 'function') {
  const nuxtApp = useNuxtApp();
  const pageData = nuxtApp?.payload?.data?.pageData || {};
  locationId = pageData.locationId;
}

// Fallback to Nuxt 2
if (!locationId && window.__NUXT__) {
  const nuxtData = window.__NUXT__.data?.[0]?.pageData || window.__NUXT__.pageData || {};
  locationId = nuxtData.locationId;
}

// Send it back to extension
window.postMessage({
  type: 'GHL_DATA',
  locationId: locationId
}, '*');
```

### Using It in Your Extension

The Revex auth provides a `getLocationId()` method:

```javascript
// In your code
const locationId = await window.ghlUtilsRevex.getLocationId();
console.log('Location/Company ID:', locationId);
```

## API Endpoint for Snapshots

Now you can use this to fetch snapshots:

```javascript
// Get company ID
const companyId = await window.ghlUtilsRevex.getLocationId();

// Fetch all snapshots for this company
const endpoint = `/snapshots/v2/${companyId}?companyId=${companyId}&skip=0&limit=20&type=own`;
const snapshots = await window.ghlUtilsRevex.get(endpoint);

console.log('Snapshots:', snapshots);
```

## Complete Example: List All Snapshots

```javascript
async function listAllSnapshots() {
  // Get company ID
  const companyId = await window.ghlUtilsRevex.getLocationId();
  console.log('Company ID:', companyId);

  // Fetch snapshots
  const response = await window.ghlUtilsRevex.get(
    `/snapshots/v2/${companyId}?companyId=${companyId}&skip=0&limit=20&type=own`
  );

  const snapshots = response.data || response;
  console.log(`Found ${snapshots.length} snapshots:`);

  snapshots.forEach((snapshot, i) => {
    console.log(`${i + 1}. ${snapshot.name} (${snapshot._id})`);
  });

  return snapshots;
}

// Run it
await listAllSnapshots();
```

## Example Output

```
Company ID: 3WEvz5mHuGnbYw1odUaF
Found 5 snapshots:
1. Main Snapshot (uTwVJ3PkF5HRM5oxCpL1)
2. Backup 2025-01 (xYz123...)
3. Test Snapshot (aBc456...)
4. Production (dEf789...)
5. Development (gHi012...)
```

## Integration with Snapshot Exporter

You can enhance the snapshot exporter to auto-detect and list available snapshots:

```javascript
// Get company ID
const companyId = await window.ghlUtilsRevex.getLocationId();

// Fetch all snapshots
const snapshotsResponse = await window.ghlUtilsRevex.get(
  `/snapshots/v2/${companyId}?companyId=${companyId}&skip=0&limit=20&type=own`
);

const snapshots = snapshotsResponse.data || snapshotsResponse;

// Let user choose which snapshot to export
snapshots.forEach(snapshot => {
  console.log(`Snapshot: ${snapshot.name} - ID: ${snapshot._id}`);
});

// Export specific snapshot
const snapshotToExport = snapshots[0]; // or let user choose
await window.ghlSnapshotExporter.exportSnapshotWithIds(
  snapshotToExport._id,
  companyId
);
```

## Where Company ID Comes From

### 1. **URL** (Most Common)
```
https://app.gohighlevel.com/location/3WEvz5mHuGnbYw1odUaF/dashboard
                                      ^^^^^^^^^^^^^^^^^^^^
                                      This is the locationId
```

### 2. **Vue App Context** (Nuxt)
```javascript
// Nuxt 3
useNuxtApp().payload.data.pageData.locationId

// Nuxt 2
window.__NUXT__.data[0].pageData.locationId
```

### 3. **Chrome Storage** (Cached by Extension)
```javascript
chrome.storage.local.get(['locationId'], (result) => {
  console.log(result.locationId);
});
```

## API Endpoints Reference

### Get All Snapshots
```http
GET /snapshots/v2/{companyId}
Parameters:
  - companyId: {companyId}
  - skip: 0
  - limit: 20
  - type: own
```

### Get Snapshot Assets
```http
GET /snapshots-appengine/snapshot/{snapshotId}/get_assets
Parameters:
  - type: own
  - companyId: {companyId}
```

## Testing in Console

### Step 1: Check if Revex is Ready
```javascript
console.log('Revex ready?', window.ghlUtilsRevex?.isReady());
```

### Step 2: Get Company ID
```javascript
const companyId = await window.ghlUtilsRevex.getLocationId();
console.log('Company ID:', companyId);
```

### Step 3: List Snapshots
```javascript
const snapshots = await window.ghlUtilsRevex.get(
  `/snapshots/v2/${companyId}?companyId=${companyId}&skip=0&limit=20&type=own`
);
console.log('Snapshots:', snapshots);
```

### Step 4: Export Specific Snapshot
```javascript
const snapshotId = 'uTwVJ3PkF5HRM5oxCpL1'; // or from list above
await window.ghlSnapshotExporter.exportSnapshotWithIds(snapshotId, companyId);
```

## Enhanced Snapshot Exporter (Future)

You could create a snapshot selector UI:

```javascript
async function showSnapshotSelector() {
  // Get company ID
  const companyId = await window.ghlUtilsRevex.getLocationId();

  // Fetch snapshots
  const response = await window.ghlUtilsRevex.get(
    `/snapshots/v2/${companyId}?companyId=${companyId}&skip=0&limit=100&type=own`
  );

  const snapshots = response.data || response;

  // Show in popup UI
  const select = document.createElement('select');
  snapshots.forEach(snapshot => {
    const option = document.createElement('option');
    option.value = snapshot._id;
    option.textContent = `${snapshot.name} (${new Date(snapshot.createdAt).toLocaleDateString()})`;
    select.appendChild(option);
  });

  // Let user choose and export
  select.addEventListener('change', async () => {
    const snapshotId = select.value;
    await window.ghlSnapshotExporter.exportSnapshotWithIds(snapshotId, companyId);
  });

  return select;
}
```

## Snapshot Response Format

```json
{
  "data": [
    {
      "_id": "uTwVJ3PkF5HRM5oxCpL1",
      "name": "Main Snapshot",
      "description": "Production snapshot",
      "locationId": "location123",
      "companyId": "3WEvz5mHuGnbYw1odUaF",
      "type": "own",
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-01-15T10:30:00Z",
      "status": "completed"
    },
    ...
  ],
  "total": 5,
  "skip": 0,
  "limit": 20
}
```

## Summary

To get the company ID through Revex:

```javascript
// Simple one-liner
const companyId = await window.ghlUtilsRevex.getLocationId();
```

Then use it to:
1. ✅ List all snapshots for the company
2. ✅ Export specific snapshots
3. ✅ Fetch any company-specific data

---

**The company ID is automatically extracted from the GHL Vue app by inject.js and made available through Revex!** 🎯
