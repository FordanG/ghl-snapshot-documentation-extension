# Getting Started with GHL Snapshot Export

## Quick Start Guide

### Installation (5 minutes)

1. **Open Chrome Extensions Page**
   ```
   Navigate to: chrome://extensions/
   ```

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Navigate to and select: `/Users/poppo/Projects/snapshot-export-documentation`
   - Click "Select Folder"

4. **Verify Installation**
   - You should see "GHL Snapshot Export Documentation v1.0.0" in your extensions list
   - The extension icon should appear in your Chrome toolbar

### First Export (2 minutes)

1. **Go to GoHighLevel**
   - Log into your GHL account
   - Navigate to any snapshot page
   - URL should look like: `https://app.gohighlevel.com/.../snapshot/xxxxx`

2. **Click the Extension Icon**
   - Find the extension icon in your Chrome toolbar
   - Click it to open the popup

3. **Click "Export Current Snapshot"**
   - The extension will automatically detect your snapshot ID and company ID
   - Watch the progress bar
   - CSV files will download to your Downloads folder

4. **Check Your Downloads**
   - You should see multiple CSV files:
     - `Snapshot_xxx_SUMMARY_xxx.csv` (overview)
     - `Snapshot_xxx_Workflows_xxx.csv` (if you have workflows)
     - `Snapshot_xxx_Forms_xxx.csv` (if you have forms)
     - And more...

## Understanding the Extension

### What It Does

This extension exports ALL assets from a GHL snapshot to CSV files for documentation:

- **Custom Fields** - Field definitions
- **Workflows** - Automation workflows
- **Forms & Surveys** - All forms and surveys
- **Funnels** - Website pages and funnels
- **Calendars** - Calendar settings
- **Tags & Pipelines** - Organization structures
- **And 20+ more asset types**

### How It Works

```
1. You click "Export"
   ↓
2. Extension authenticates using Revex (your GHL session)
   ↓
3. Fetches snapshot data from GHL API
   ↓
4. Converts JSON data to CSV format
   ↓
5. Downloads multiple CSV files (one per asset type)
```

### Key Technologies

- **Revex Auth**: Uses GHL's internal authentication (based on GHL Utils pattern)
- **Chrome Extension**: Runs directly in your browser
- **No API Keys Needed**: Uses your active GHL login session
- **Local Processing**: All conversion happens in your browser

## Sample Export Structure

After exporting, you'll get files like:

```
Downloads/
├── Snapshot_uTwVJ3Pk_SUMMARY_2025-10-29T10-30-00.csv
├── Snapshot_uTwVJ3Pk_Custom_Fields_2025-10-29T10-30-02.csv
├── Snapshot_uTwVJ3Pk_Tags_2025-10-29T10-30-03.csv
├── Snapshot_uTwVJ3Pk_Workflows_2025-10-29T10-30-04.csv
├── Snapshot_uTwVJ3Pk_Forms_2025-10-29T10-30-05.csv
├── Snapshot_uTwVJ3Pk_Surveys_2025-10-29T10-30-06.csv
└── ... (more files depending on what's in your snapshot)
```

## Common Use Cases

### 1. Documentation
Export snapshot assets to create comprehensive documentation of your GHL setup.

### 2. Auditing
Review all assets in a snapshot before importing or making changes.

### 3. Comparison
Export multiple snapshots and compare them to see what changed.

### 4. Migration Planning
Understand all components before migrating to a new location.

### 5. Backup Records
Keep CSV records of your snapshot contents for reference.

## API Endpoint Used

The extension calls this GHL internal API:

```
GET https://backend.leadconnectorhq.com/snapshots-appengine/snapshot/{snapshotId}/get_assets
Parameters:
  - type: 'own'
  - companyId: {your-company-id}
```

Example from your data:
```
https://backend.leadconnectorhq.com/snapshots-appengine/snapshot/uTwVJ3PkF5HRM5oxCpL1/get_assets?type=own&companyId=3WEvz5mHuGnbYw1odUaF
```

## Comparison with GHL Utils

This extension is inspired by and built using patterns from **GHL Utils**:

### Shared Architecture
- ✅ Same Revex authentication pattern
- ✅ Same message-passing bridge
- ✅ Similar CSV export methodology
- ✅ Chrome extension architecture

### Key Differences

| Feature | GHL Utils | Snapshot Export |
|---------|-----------|-----------------|
| **Purpose** | Productivity & navigation | Snapshot documentation |
| **Export Focus** | Workflows only | All asset types |
| **Output** | 1 detailed CSV | Multiple CSVs |
| **Analysis** | Deep workflow analysis | Asset inventory |
| **Asset Types** | 1 | 27+ |

### Files Copied from GHL Utils
- `revex-auth.js` - Authentication bridge
- `inject.js` - Vue app access
- `icons/*.png` - Extension icons

### New Implementation
- `snapshot-exporter.js` - Snapshot-specific export logic
- `popup.html` - New UI for snapshot export
- `popup.js` - New UI controller

## Troubleshooting

### Extension won't load
- Check that all files are present
- Ensure icons folder has all three PNG files
- Try reloading: chrome://extensions/ → Reload button

### "Revex authentication not available"
- Refresh the GHL page
- Ensure you're logged into GHL
- The page needs to fully load before Revex initializes

### No CSV files downloaded
- Check Chrome downloads: chrome://downloads/
- Disable popup blocker for GHL domain
- Check browser permissions for downloads

### Empty or missing asset types
- The snapshot may not have those asset types
- Check the SUMMARY CSV to see what was found
- Some snapshots have different asset combinations

## Next Steps

1. **Try an export** with the Quick Start guide above
2. **Review the CSV files** in your Downloads folder
3. **Read the full README.md** for detailed documentation
4. **Check console logs** (F12) if you encounter issues

## File Structure

```
snapshot-export-documentation/
├── manifest.json              # Extension configuration
├── background.js             # Service worker
├── revex-auth.js             # Authentication (from GHL Utils)
├── inject.js                 # Page context script (from GHL Utils)
├── snapshot-exporter.js      # Main export logic (NEW)
├── popup.html                # UI (NEW)
├── popup.js                  # UI controller (NEW)
├── icons/                    # Extension icons (from GHL Utils)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── README.md                 # Full documentation
├── GETTING_STARTED.md        # This file
└── CREATE_ICONS.md           # Icon creation guide
```

## Support

For questions or issues:
1. Read the full README.md
2. Check browser console (F12)
3. Verify GHL page is fully loaded
4. Review the example data structure below

## Example Data Structure

The snapshot data looks like this:

```json
{
  "custom_fields": [
    { "id": "abc123", "name": "NDIS" },
    { "id": "def456", "name": "Survey Results" }
  ],
  "tags": [
    { "id": "tag1", "name": "active support" },
    { "id": "tag2", "name": "client - potential" }
  ],
  "workflow": [
    { "id": "wf1", "name": "MM 💘 - Working Match", "type": "directory" }
  ],
  ...
}
```

Each array is exported to its own CSV file with columns matching the object keys.

---

**Ready to export? Go to chrome://extensions/ and load the extension!**
