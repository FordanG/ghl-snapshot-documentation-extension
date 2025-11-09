# Snapshot Endpoints Quick Reference

## Essential Endpoints for Building Snapshot Documentation

### 🔑 Authentication
```
POST /oauth/2/login/token
```
Get JWT tokens for authentication

---

### 📋 Core Snapshot Endpoints

#### 1. List All Snapshots
```
GET /snapshots/v2/{companyId}?skip=0&limit=20&type=own
```
**Returns**: List of snapshots with IDs, names, and dates

#### 2. Get Snapshot Details ⭐
```
GET /snapshots/snapshotDetails/{snapshotId}?companyId={companyId}
```
**Returns**: Full snapshot metadata + asset data paths
**Use this for**: Snapshot name, creation date, asset paths

#### 3. Get All Assets Summary ⭐⭐⭐
```
GET /snapshots-appengine/snapshot/{snapshotId}/get_assets?type=own&companyId={companyId}
```
**Returns**: Complete asset inventory with names & IDs
**Use this for**: Counting assets, listing all workflows, forms, funnels, etc.

**Asset Categories in Response**:
- `workflow` - Automation workflows
- `forms` - Web forms
- `funnels` - Funnels & websites
- `calendars` - Calendar configurations
- `custom_fields` - Custom fields
- `custom_objects` - Custom object schemas
- `tags` - Contact tags
- `pipelines` - Opportunity pipelines
- `email_templates` - Email templates
- `text_templates` - SMS templates
- `surveys` - Surveys
- `quizzes` - Quizzes
- `dashboards` - Custom dashboards
- `conversation_ai` - AI agents
- `knowledge_bases` - Knowledge bases
- `certificates` - Certificate templates
- `membership_products` - Products
- `review_settings` - Review settings
- `links` - Trigger links
- `custom_values` - Custom values

#### 4. Get Snapshot Versions
```
GET /snapshots/snapshot-versions/{snapshotId}?companyId={companyId}&page=1&limit=20
```
**Returns**: Version history

#### 5. Get Assets Processing Status
```
GET /snapshots/{snapshotId}/assets-status?companyId={companyId}
```
**Returns**: Which assets are ready/processing

#### 6. Get Snapshot Preferences
```
GET /snapshots/{snapshotId}/snapshot-preferences?companyId={companyId}
```
**Returns**: Sharing settings

#### 7. Get Location Assets (Detailed)
```
GET /snapshots/location-assets/{snapshotId}?page=1&take=20&q=&companyId={companyId}
```
**Returns**: Paginated detailed asset data

#### 8. Get Snapshot Templates
```
GET /snapshots/snapshot-templates/list?companyId={companyId}&skip=0&limit=20
```
**Returns**: Available marketplace templates

#### 9. Get Share Accounts
```
GET /snapshots/list/share-accounts/v2?companyId={companyId}&skip=0&limit=20
```
**Returns**: Companies this snapshot is shared with

---

### 🏢 Supporting Company Endpoints

#### Get Company Info
```
GET /companies/{companyId}
```

#### Get Company Feature Flags
```
GET /companies/{companyId}/labs/featureFlags
```

---

## 🚀 Quick Start: 3-Step Documentation Build

### Minimal Approach (3 API calls)

```bash
# Step 1: Get snapshot metadata
GET /snapshots/snapshotDetails/uTwVJ3PkF5HRM5oxCpL1?companyId={companyId}

# Step 2: Get all assets
GET /snapshots-appengine/snapshot/uTwVJ3PkF5HRM5oxCpL1/get_assets?type=own&companyId={companyId}

# Step 3: Get asset status
GET /snapshots/uTwVJ3PkF5HRM5oxCpL1/assets-status?companyId={companyId}
```

**This gives you**:
- ✅ Snapshot name and dates
- ✅ Complete asset inventory (names, IDs, counts)
- ✅ Asset processing status
- ✅ Asset data storage paths

---

## 📊 Example Response Data

### Snapshot Assets Response
```json
{
  "workflow": [
    {"id": "wf1", "name": "Welcome Sequence", "type": "automation"}
  ],
  "forms": [
    {"id": "form1", "name": "Contact Form"}
  ],
  "funnels": [
    {"id": "funnel1", "name": "Landing Page"}
  ],
  "custom_fields": [
    {"id": "cf1", "name": "Lead Source"}
  ],
  "tags": [
    {"id": "tag1", "name": "Hot Lead"}
  ],
  "pipelines": [
    {"id": "pipe1", "name": "Sales Pipeline"}
  ],
  "calendars": [
    {"id": "cal1", "name": "Consultation Calendar"}
  ],
  "conversation_ai": [
    {"id": "ai1", "name": "Support Bot"}
  ]
}
```

### From This You Can Generate:

**Asset Counts**:
- 211 Workflows
- 14 Forms
- 17 Funnels
- 259 Custom Fields
- 171 Tags
- 4 Pipelines
- 12 Calendars
- 2 AI Agents
- 2 Knowledge Bases
- 5 Email Templates
- 43 SMS Templates
- 13 Surveys
- 1 Quiz
- 4 Dashboards
- 3 Custom Objects
- 1 Certificate
- 1 Membership Product

**Asset Names & IDs**:
For creating detailed documentation or exports

---

## 🎯 Use Cases

### 1. Generate Snapshot Documentation
**Endpoints**: #2, #3, #5
**Output**: PDF/Markdown documentation listing all assets

### 2. Compare Two Snapshots
**Endpoints**: #3 for both snapshots
**Output**: Diff showing added/removed assets

### 3. Snapshot Inventory Report
**Endpoints**: #1, #3
**Output**: Excel/CSV with all snapshots and their asset counts

### 4. Track Snapshot Changes Over Time
**Endpoints**: #4, #2
**Output**: Version history with changes

### 5. Asset Search/Filter
**Endpoints**: #7 with search query
**Output**: Find specific workflows, forms, etc.

---

## 💡 Pro Tips

1. **Always start with** `/snapshots/snapshotDetails/{id}` to verify snapshot exists
2. **Use** `/get_assets` endpoint for bulk asset names - it's faster than paginated endpoint
3. **Check** `/assets-status` before trying to access asset data - some may still be processing
4. **Pagination**: For snapshots with 1000+ assets, use `/location-assets` with pagination
5. **Caching**: Asset lists change infrequently - safe to cache for several minutes

---

## 🔐 Required Headers

```http
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

Some endpoints also accept/require:
```http
token-id: {firebase_token}
```

---

## 📝 Example: Generate Asset Count Report

```javascript
// Fetch all snapshot assets
const response = await fetch(
  `https://backend.leadconnectorhq.com/snapshots-appengine/snapshot/${snapshotId}/get_assets?type=own&companyId=${companyId}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const assets = await response.json();

// Generate counts
const report = {
  workflows: assets.workflow?.length || 0,
  forms: assets.forms?.length || 0,
  funnels: assets.funnels?.length || 0,
  calendars: assets.calendars?.length || 0,
  customFields: assets.custom_fields?.length || 0,
  tags: assets.tags?.length || 0,
  pipelines: assets.pipelines?.length || 0,
  emailTemplates: assets.email_templates?.length || 0,
  aiAgents: assets.conversation_ai?.length || 0,
  knowledgeBases: assets.knowledge_bases?.length || 0,
  customObjects: assets.custom_objects?.length || 0
};

console.log('Snapshot Asset Summary:', report);
```

---

## 🎨 Output Format Ideas

Based on these endpoints, you can create:

1. **Markdown Documentation** (like this file!)
2. **JSON Export** (full structured data)
3. **PDF Report** (visual overview)
4. **Excel Spreadsheet** (asset inventory)
5. **HTML Dashboard** (interactive view)
6. **CLI Tool** (terminal-based explorer)

---

## 📍 Key IDs You'll Need

From your export filename: `Snapshot_uTwVJ3PkF5HRM5oxCpL1_Export_2025-10-31T17-07-01`

- **Snapshot ID**: `uTwVJ3PkF5HRM5oxCpL1`
- **Company ID**: Find via `/companies` endpoint or from initial auth
- **Location ID**: Optional, included in snapshot details

---

## ⚡ Rate Limiting & Best Practices

1. **Batch requests** where possible
2. **Use pagination** for large datasets (>100 items)
3. **Cache responses** when data doesn't change frequently
4. **Handle 401/403** by refreshing auth tokens
5. **Check asset status** before trying to download asset data

---

**Generated from**: Analysis of `backend.leadconnectorhq.com` API traffic
**Date**: 2025-11-02
**Source**: Real production API captures
