# ✨ Super Snapshots AI

An AI-powered Chrome extension that exports and enriches GoHighLevel (GHL) snapshot assets with intelligent analysis and comprehensive documentation.

## Overview

Super Snapshots AI utilizes GHL's internal Revex backend API to fetch and export all assets from a snapshot, with AI-powered enrichment that adds intelligent descriptions, usage statistics, and detailed configurations. Export to Excel or CSV formats for documentation, auditing, or migration planning.

## Features

- **🤖 AI-Powered Enrichment**: Intelligent analysis and descriptions for workflows and assets
- **📊 17 Enriched Asset Types**: Deep enrichment with usage statistics, configurations, and relationships
- **📁 Excel & CSV Export**: Export to .xlsx workbooks or individual CSV files
- **🎯 Automatic Detection**: Detects snapshot ID and company ID from the current GHL page
- **⚡ Real-time Progress**: Live progress tracking during export
- **📋 Comprehensive Coverage**: Exports 27+ different asset types
- **🎨 Beautiful Purple UI**: Modern, professional interface inspired by supercloner.app

## What Gets Exported

The extension exports the following asset types:

### Core Assets
- **Custom Fields** - All custom fields with IDs and names
- **Custom Values** - Custom value configurations
- **Tags** - All tags used in the snapshot
- **Pipelines** - Pipeline configurations and stages

### Communication & Engagement
- **Workflows** - Workflow definitions and configurations
- **Triggers** - Automation triggers
- **Campaigns** - Campaign settings
- **Forms** - Form builders and submissions
- **Surveys** - Survey configurations
- **Text Templates** - SMS/text message templates
- **Email Templates** - Email templates and designs

### Pages & Content
- **Funnels** - Funnel pages and websites
- **Links** - Tracking links and redirects
- **Calendars** - Calendar configurations and availability

### Business & Services
- **Membership Offers** - Membership offer configurations
- **Membership Products** - Membership product details
- **Certificates** - Certificate templates

### Organization
- **Folders** - Folder structure and organization
- **Teams** - Team configurations and permissions
- **Dashboards** - Dashboard layouts and widgets

### Advanced Features
- **Knowledge Bases** - Knowledge base content
- **Quizzes** - Quiz configurations
- **Custom Objects** - Custom object schemas
- **Conversation AI** - AI assistant configurations
- **Social Planner** - Social media planning content
- **Section Templates** - Reusable section templates
- **Review Settings** - Review collection settings

## Installation

### Option 1: Load as Unpacked Extension (Development)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the `snapshot-export-documentation` folder
6. The extension icon should appear in your Chrome toolbar

### Option 2: Install Icons

If you see icon errors, create placeholder icons:

```bash
cd snapshot-export-documentation
mkdir -p icons
# Create placeholder icons (you can replace these with actual icons later)
```

Or download icons and place them in the `icons/` folder:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

## Usage

### Method 1: Auto-Detect Mode (Recommended)

1. **Navigate to a Snapshot Page** in GoHighLevel
   - URL should contain `/snapshot/{snapshotId}`
   - Example: `https://app.gohighlevel.com/location/abc123/snapshot/uTwVJ3PkF5HRM5oxCpL1`

2. **Click the Extension Icon** in your Chrome toolbar

3. **Click "Export Current Snapshot"**
   - The extension will automatically detect:
     - Snapshot ID from the URL
     - Company ID from the URL or your GHL session

4. **Wait for Export to Complete**
   - You'll see progress updates
   - Multiple CSV files will download to your Downloads folder

### Method 2: Manual Entry Mode

Use this method if:
- You're not on a snapshot page
- Auto-detection fails
- You want to export a specific snapshot

1. **Click the Extension Icon**

2. **Enter IDs Manually:**
   - **Snapshot ID**: Found in the snapshot URL (e.g., `uTwVJ3PkF5HRM5oxCpL1`)
   - **Company ID**: Your GHL company/location ID (e.g., `3WEvz5mHuGnbYw1odUaF`)

3. **Click "Export with IDs"**

4. **Wait for Export to Complete**

## Finding Your IDs

### Snapshot ID

Located in the GHL URL when viewing a snapshot:
```
https://app.gohighlevel.com/location/{locationId}/snapshot/uTwVJ3PkF5HRM5oxCpL1
                                                             ^^^^^^^^^^^^^^^^^^^^
                                                             This is the Snapshot ID
```

### Company ID

Can be found in several places:
1. **In the URL** when viewing any GHL location page:
   ```
   https://app.gohighlevel.com/location/3WEvz5mHuGnbYw1odUaF/dashboard
                                        ^^^^^^^^^^^^^^^^^^^^
                                        This is the Company/Location ID
   ```

2. **In the snapshot URL parameters**:
   ```
   https://backend.leadconnectorhq.com/snapshots-appengine/snapshot/xxx/get_assets?companyId=3WEvz5mHuGnbYw1odUaF
   ```

3. **Auto-detected** from your current GHL session

## Understanding Revex Authentication

This extension uses **Revex Auth**, which is GHL's internal backend service authentication method.

### How It Works

1. **Session-Based**: Uses your existing GHL login session
2. **No API Keys Required**: No need to create or configure API keys
3. **Automatic**: Works as long as you're logged into GHL
4. **Secure**: Leverages GHL's own authentication system

### Technical Details

The extension uses a message-passing bridge to access GHL's Vue.js application context:

```
inject.js (Page Context)
    ↓
Accesses Vue App → Revex Backend Service
    ↓
revex-auth.js (Extension Context)
    ↓
Makes API Calls to GHL Backend
```

### Troubleshooting Revex Auth

If you see "Revex authentication not available":

1. **Refresh the page** - Revex initializes on page load
2. **Ensure you're logged into GHL** - The extension uses your session
3. **Check console** - Open DevTools (F12) and check for errors
4. **Reload extension** - Go to `chrome://extensions/` and reload the extension

## Output Files

The extension generates multiple CSV files:

### 1. Summary File
`Snapshot_{snapshotId}_SUMMARY_{timestamp}.csv`

Contains:
- Export metadata (date, snapshot ID)
- Count of each asset type
- Which asset types have CSV files generated

### 2. Individual Asset Files
`Snapshot_{snapshotId}_{AssetType}_{timestamp}.csv`

One file per asset type containing all items of that type.

Example files:
- `Snapshot_uTwVJ3Pk_Custom_Fields_2025-01-15T10-30-00.csv`
- `Snapshot_uTwVJ3Pk_Workflows_2025-01-15T10-30-05.csv`
- `Snapshot_uTwVJ3Pk_Forms_2025-01-15T10-30-10.csv`

## CSV Format

### Headers
Each CSV file has:
- **First row**: Column headers (field names)
- **Subsequent rows**: Data for each asset

### Data Formatting

- **Simple values**: Exported as-is
- **Arrays**: Joined with semicolons (`;`)
- **Objects**: JSON stringified
- **Null/undefined**: Empty string
- **Special characters**: Properly escaped for CSV

### Excel Compatibility

All CSV files include:
- **UTF-8 BOM**: For proper encoding in Excel
- **Quoted strings**: Special characters are properly escaped
- **Comma-safe**: All commas in data are escaped

## Architecture

### File Structure

```
snapshot-export-documentation/
├── manifest.json              # Chrome extension manifest
├── background.js             # Service worker
├── revex-auth.js             # Revex authentication bridge
├── inject.js                 # Page context script (Vue app access)
├── snapshot-exporter.js      # Main export logic
├── popup.html                # Extension popup UI
├── popup.js                  # Popup UI controller
├── icons/                    # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md                 # This file
```

### Key Components

#### 1. Revex Auth (`revex-auth.js`)
- Handles authentication with GHL's backend
- Creates message bridge between page and extension
- Manages request queue and promises

#### 2. Inject Script (`inject.js`)
- Runs in page context
- Accesses GHL's Vue.js application
- Extracts authentication tokens
- Provides access to Revex backend service

#### 3. Snapshot Exporter (`snapshot-exporter.js`)
- Main export orchestration
- Fetches snapshot data from API
- Converts JSON to CSV format
- Handles file downloads
- Sends progress updates

#### 4. Popup UI (`popup.html` + `popup.js`)
- User interface for the extension
- Export button handlers
- Progress display
- Error messaging

## API Endpoint

The extension uses GHL's internal API:

```
GET https://backend.leadconnectorhq.com/snapshots-appengine/snapshot/{snapshotId}/get_assets
Parameters:
  - type: 'own' (default)
  - companyId: Your company/location ID
```

Response format:
```json
{
  "custom_fields": [...],
  "tags": [...],
  "workflows": [...],
  ...
}
```

## Comparison with GHL Utils Workflow Export

This extension is inspired by the workflow export functionality in **GHL Utils**:

### Similarities
- Uses same Revex authentication pattern
- Similar CSV export methodology
- Progress tracking during export
- Chrome extension architecture

### Differences

| Feature | GHL Utils | Snapshot Export |
|---------|-----------|----------------|
| **Focus** | Workflows only | All snapshot assets |
| **Output** | Single CSV | Multiple CSVs |
| **Use Case** | Workflow analysis | Complete documentation |
| **Asset Types** | 1 type | 27+ types |
| **Analysis Depth** | Deep workflow analysis | Asset inventory |

## Troubleshooting

### "Revex authentication not available"
- Refresh the GHL page
- Ensure you're logged into GHL
- Reload the extension

### "Could not detect snapshot ID"
- Use Manual Entry mode
- Ensure you're on a snapshot page
- Check that URL contains `/snapshot/{id}`

### "Failed to fetch snapshot data"
- Verify your Company ID is correct
- Check that you have access to the snapshot
- Ensure GHL backend is accessible

### No CSV files downloaded
- Check your browser's download settings
- Verify popup blocker isn't blocking downloads
- Check Chrome's Downloads page (Ctrl+J / Cmd+J)

### Extension not showing
- Go to `chrome://extensions/`
- Ensure extension is enabled
- Check for any error messages
- Try reloading the extension

## Development

### Prerequisites
- Chrome browser
- Basic knowledge of Chrome extensions
- Understanding of JavaScript and async/await

### Local Development

1. **Clone the repository**
   ```bash
   cd /Users/poppo/Projects/snapshot-export-documentation
   ```

2. **Load in Chrome**
   - Navigate to `chrome://extensions/`
   - Enable Developer mode
   - Click "Load unpacked"
   - Select the project folder

3. **Make changes**
   - Edit files as needed
   - Click reload button in `chrome://extensions/` to test

4. **Debug**
   - Open DevTools on the extension popup: Right-click → Inspect
   - Check console in GHL page for content script logs
   - View background script logs in `chrome://extensions/` → Service worker → Console

### Key Functions

#### `exportSnapshotAssets(snapshotId, companyId, type)`
Main export orchestrator. Fetches data and generates CSV files.

#### `convertSnapshotToCSVs(snapshotData, snapshotId)`
Converts JSON snapshot data to multiple CSV files.

#### `convertAssetTypeToCSV(assets, assetTypeName)`
Converts a specific asset type array to CSV format.

#### `getCurrentSnapshotInfo()`
Auto-detects snapshot and company IDs from the current page.

## Future Enhancements

Potential features for future versions:

- [ ] Filter specific asset types to export
- [ ] Export to JSON format option
- [ ] Batch export multiple snapshots
- [ ] Compare two snapshots
- [ ] Asset relationship mapping
- [ ] Custom CSV column selection
- [ ] Export scheduling
- [ ] Cloud storage integration

## Security & Privacy

- **No data storage**: Extension doesn't store any GHL data
- **Session-based auth**: Uses your existing GHL login
- **No external servers**: All processing happens locally
- **Open source**: Code is transparent and auditable

## License

This is a development tool for internal use. Not affiliated with or endorsed by GoHighLevel.

## Support

For issues or questions:
1. Check this README
2. Review console logs (F12)
3. Verify you're using the latest version
4. Check GHL Utils implementation for reference

## Changelog

### Version 1.0.0 (2025-01-15)
- Initial release
- Revex authentication integration
- 27+ asset type support
- Auto-detect and manual entry modes
- Progress tracking
- Multiple CSV file generation
- Summary report generation

## Credits

- Inspired by **GHL Utils** workflow export functionality
- Uses revex-auth pattern from GHL Utils
- Built for the GoHighLevel community

## Related Projects

- **GHL Utils**: https://github.com/your-repo/ghl-utils (Chrome extension for GHL productivity)

---

Made with ❤️ for the GoHighLevel community
