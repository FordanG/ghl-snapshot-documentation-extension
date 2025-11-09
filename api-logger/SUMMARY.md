# Snapshot API Extraction Summary

## 📁 Files Generated

### 1. `backend_leadconnectorhq_endpoints.json` (448KB)
Complete JSON file containing all 44 backend.leadconnectorhq.com endpoints with:
- Endpoint paths
- HTTP methods
- Example URLs with query parameters
- Sample JSON responses (43 out of 44 endpoints have responses captured)

### 2. `SNAPSHOT_API_DOCUMENTATION.md`
Comprehensive documentation including:
- All 10 snapshot-related endpoints
- Detailed request/response structures
- Query parameters and examples
- Step-by-step guide to build snapshot documentation
- Python example code
- Asset categories explanation

### 3. `SNAPSHOT_ENDPOINTS_QUICK_REFERENCE.md`
Quick reference guide with:
- Essential endpoints for snapshot documentation
- 3-step minimal approach
- Use cases and examples
- Pro tips and best practices
- JavaScript code examples

---

## 🎯 Key Findings

### Snapshot Endpoints Discovered (10 total)

**Primary Endpoints**:
1. `GET /snapshots/v2/{companyId}` - List all snapshots
2. `GET /snapshots/snapshotDetails/{snapshotId}` - Get snapshot metadata
3. `GET /snapshots-appengine/snapshot/{snapshotId}/get_assets` - Get all assets (MOST IMPORTANT)

**Secondary Endpoints**:
4. `GET /snapshots/snapshot-versions/{snapshotId}` - Version history
5. `GET /snapshots/{snapshotId}/assets-status` - Processing status
6. `GET /snapshots/{snapshotId}/snapshot-preferences` - Share settings
7. `GET /snapshots/location-assets/{snapshotId}` - Detailed paginated assets
8. `GET /snapshots/snapshot-templates/list` - Marketplace templates
9. `GET /snapshots/list/share-accounts/v2` - Sharing info

---

## 📊 Asset Types Available in Snapshots

From the `/get_assets` endpoint, you can retrieve:

**Core Assets** (with sample counts from your snapshot):
- ✅ **211 Workflows** - Automation workflows
- ✅ **17 Funnels** - Landing pages & websites
- ✅ **14 Forms** - Web forms
- ✅ **12 Calendars** - Calendar configurations
- ✅ **259 Custom Fields** - Contact/company custom fields
- ✅ **171 Tags** - Contact tags
- ✅ **43 SMS Templates** - Text message templates
- ✅ **13 Surveys** - Survey forms
- ✅ **5 Email Templates** - Email templates
- ✅ **4 Pipelines** - Opportunity pipelines
- ✅ **4 Dashboards** - Custom dashboards
- ✅ **3 Custom Objects** - Object schemas
- ✅ **2 AI Agents** - Conversation AI
- ✅ **2 Knowledge Bases** - AI knowledge bases
- ✅ **1 Quiz** - Quiz form
- ✅ **1 Certificate** - Certificate template
- ✅ **1 Membership Product** - Product
- ✅ **1 Review Settings** - Review configuration
- ✅ **15 Custom Values** - Custom value options
- ✅ **1 Trigger Link** - Trigger link

**Total**: 779+ individual assets in this snapshot!

---

## 🚀 How to Use These Endpoints

### For Building Snapshot Documentation (Like Your Export File)

**Minimum Required API Calls**:

```bash
# 1. Get snapshot metadata
GET /snapshots/snapshotDetails/uTwVJ3PkF5HRM5oxCpL1?companyId={companyId}
→ Returns: name, dates, asset paths

# 2. Get all assets with names and IDs
GET /snapshots-appengine/snapshot/uTwVJ3PkF5HRM5oxCpL1/get_assets?type=own&companyId={companyId}
→ Returns: Complete inventory of all assets

# 3. Get processing status (optional)
GET /snapshots/uTwVJ3PkF5HRM5oxCpL1/assets-status?companyId={companyId}
→ Returns: Which assets are ready
```

**What You Can Build**:
1. Asset inventory report (counts and names)
2. Documentation export (like your original export file)
3. Comparison between snapshots
4. Asset search/filtering tool
5. Snapshot version tracking

---

## 💡 Key Insights

### Authentication Required
All endpoints need:
```http
Authorization: Bearer {jwt_token}
```

Get token from:
```
POST /oauth/2/login/token
```

### Snapshot ID
From your filename `Snapshot_uTwVJ3PkF5HRM5oxCpL1_Export_2025-10-31T17-07-01`:
- Snapshot ID: `uTwVJ3PkF5HRM5oxCpL1`

### Most Valuable Endpoint
```
GET /snapshots-appengine/snapshot/{id}/get_assets
```
This single endpoint gives you:
- All asset names and IDs
- Grouped by asset type
- Complete inventory
- Ready to use for documentation

---

## 📋 Recommended Workflow

### Step 1: Authentication
```bash
POST /oauth/2/login/token
# Save the JWT token
```

### Step 2: List Your Snapshots
```bash
GET /snapshots/v2/{companyId}?type=own&skip=0&limit=20
# Find the snapshot you want to document
```

### Step 3: Get Snapshot Details
```bash
GET /snapshots/snapshotDetails/{snapshotId}?companyId={companyId}
# Get metadata and configuration
```

### Step 4: Get All Assets
```bash
GET /snapshots-appengine/snapshot/{snapshotId}/get_assets?type=own&companyId={companyId}
# Get complete asset inventory
```

### Step 5: Build Your Documentation
Use the data to create:
- Markdown documentation
- JSON export
- PDF report
- Excel spreadsheet
- Interactive dashboard

---

## 🎯 Example Use Cases

### 1. Generate Asset Count Summary
```javascript
const assets = await getSnapshotAssets(snapshotId);
const summary = {
  workflows: assets.workflow.length,
  forms: assets.forms.length,
  funnels: assets.funnels.length,
  // ... etc
};
```

### 2. List All Workflow Names
```javascript
const assets = await getSnapshotAssets(snapshotId);
const workflowNames = assets.workflow.map(w => w.name);
console.log(workflowNames);
// ["Welcome Sequence", "Follow Up Series", ...]
```

### 3. Export to CSV
```javascript
const assets = await getSnapshotAssets(snapshotId);
const csv = convertAssetsToCSV(assets);
saveFile('snapshot_assets.csv', csv);
```

### 4. Compare Two Snapshots
```javascript
const snapshot1Assets = await getSnapshotAssets(snapshot1Id);
const snapshot2Assets = await getSnapshotAssets(snapshot2Id);
const diff = compareAssets(snapshot1Assets, snapshot2Assets);
```

---

## 📊 Response Data Quality

Out of 44 endpoints discovered:
- ✅ **43 endpoints** (98%) have complete JSON responses captured
- ❌ **1 endpoint** missing response data
- 🎯 **All 10 snapshot endpoints** have responses available

This means you have everything needed to:
- Understand the API structure
- Build working integrations
- Generate documentation
- Create automation tools

---

## 🔧 Next Steps

1. **Review** the documentation files
2. **Test** the endpoints with your credentials
3. **Build** your documentation generator
4. **Automate** snapshot documentation creation

---

## 📚 Documentation Files

| File | Purpose | Size |
|------|---------|------|
| `backend_leadconnectorhq_endpoints.json` | Complete API endpoint data | 448KB |
| `SNAPSHOT_API_DOCUMENTATION.md` | Full API documentation | Comprehensive |
| `SNAPSHOT_ENDPOINTS_QUICK_REFERENCE.md` | Quick reference guide | Concise |
| `SUMMARY.md` | This file | Overview |

---

## ✅ What You Now Have

✔️ Complete list of backend.leadconnectorhq.com endpoints
✔️ Sample JSON responses for 98% of endpoints
✔️ Detailed documentation for all snapshot endpoints
✔️ Quick reference guide with examples
✔️ Code examples in Python and JavaScript
✔️ Understanding of asset types and structure
✔️ API workflow and best practices

---

**Generated**: 2025-11-02
**Source**: API traffic analysis of backend.leadconnectorhq.com
**Snapshot Reference**: uTwVJ3PkF5HRM5oxCpL1
