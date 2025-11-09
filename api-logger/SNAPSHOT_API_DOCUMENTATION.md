# GoHighLevel Snapshot API Documentation

Based on analysis of `backend.leadconnectorhq.com` endpoints captured from API logs.

## Overview

This documentation describes the endpoints used to retrieve snapshot data from GoHighLevel, similar to what would be exported in `Snapshot_uTwVJ3PkF5HRM5oxCpL1_Export_2025-10-31T17-07-01`.

---

## Authentication

All endpoints require authentication via:
- **Authorization Header**: `Bearer {jwt_token}`
- **Token-ID Header**: Firebase token (for some endpoints)

To get tokens, use the login endpoint first.

---

## Core Snapshot Endpoints

### 1. Get Snapshot List

**Endpoint**: `GET /snapshots/v2/{companyId}`

**Description**: Retrieves all snapshots for a company

**Query Parameters**:
- `companyId` (required): Company ID
- `skip` (optional): Pagination offset (default: 0)
- `limit` (optional): Number of results (default: 20)
- `type` (optional): Filter by type (`imported`, `own`, etc.)

**Example**:
```
GET https://backend.leadconnectorhq.com/snapshots/v2/3WEvz5mHuGnbYw1odUaF?companyId=3WEvz5mHuGnbYw1odUaF&skip=0&limit=20&type=imported
```

**Response Structure**:
```json
{
  "snapshots": [
    {
      "_id": "snapshotId",
      "name": "Snapshot Name",
      "type": "imported|own",
      "companyId": "...",
      "locationId": "...",
      "dateAdded": "ISO-8601 timestamp",
      "dateUpdated": "ISO-8601 timestamp"
    }
  ],
  "totalCount": 10
}
```

---

### 2. Get Snapshot Details

**Endpoint**: `GET /snapshots/snapshotDetails/{snapshotId}`

**Description**: Retrieves detailed information about a specific snapshot including asset data paths

**Query Parameters**:
- `companyId` (required): Company ID

**Example**:
```
GET https://backend.leadconnectorhq.com/snapshots/snapshotDetails/uTwVJ3PkF5HRM5oxCpL1?companyId=3WEvz5mHuGnbYw1odUaF
```

**Response Structure**:
```json
{
  "_id": "uTwVJ3PkF5HRM5oxCpL1",
  "name": "Snapshot Name",
  "companyId": "3WEvz5mHuGnbYw1odUaF",
  "locationId": "locationId",
  "type": "own|imported",
  "dateAdded": "ISO-8601 timestamp",
  "dateUpdated": "ISO-8601 timestamp",
  "deleted": false,
  "dehydrationStatus": "completed",
  "assetDataPaths": [
    {
      "calendars": ["path/to/calendars-1"],
      "campaigns": [],
      "certificates": ["path/to/certificates-1"],
      "conversationAi": ["path/to/conversation_ai-1"],
      "customFields": ["path/to/custom_fields-1", "path/to/custom_fields-2"],
      "customObjects": ["path/to/custom_objects-1"],
      "customValues": ["path/to/custom_values-1"],
      "dashboards": ["path/to/dashboards-1"],
      "emailTemplates": ["path/to/email_templates-1"],
      "forms": ["path/to/forms-1"],
      "funnels": ["path/to/funnels-1", "path/to/funnels-2"],
      "knowledgeBases": ["path/to/knowledge_bases-1"],
      "links": ["path/to/links-1"],
      "membershipProducts": ["path/to/membership_products-1"],
      "pipelines": ["path/to/pipelines-1"],
      "surveys": ["path/to/surveys-1"],
      "tags": ["path/to/tags-1"],
      "textTemplates": ["path/to/text_templates-1"],
      "triggers": ["path/to/triggers-1"],
      "workflow": ["path/to/workflow-1"]
    }
  ]
}
```

---

### 3. Get Snapshot Assets (Summary)

**Endpoint**: `GET /snapshots-appengine/snapshot/{snapshotId}/get_assets`

**Description**: Retrieves a summary listing of all assets in the snapshot (names and IDs only)

**Query Parameters**:
- `type` (required): Asset type (`own`, `imported`)
- `companyId` (required): Company ID

**Example**:
```
GET https://backend.leadconnectorhq.com/snapshots-appengine/snapshot/uTwVJ3PkF5HRM5oxCpL1/get_assets?type=own&companyId=3WEvz5mHuGnbYw1odUaF
```

**Response Structure**:
```json
{
  "folders": [],
  "custom_fields": [
    {"id": "field1", "name": "Custom Field 1"},
    {"id": "field2", "name": "Custom Field 2"}
  ],
  "custom_values": [
    {"id": "val1", "name": "Value 1", "type": "text"}
  ],
  "tags": [
    {"id": "tag1", "name": "Tag Name"}
  ],
  "links": [
    {"id": "link1", "name": "Trigger Link"}
  ],
  "text_templates": [
    {"id": "tpl1", "name": "SMS Template"}
  ],
  "surveys": [
    {"id": "survey1", "name": "Survey Name", "type": "survey"}
  ],
  "pipelines": [
    {"id": "pipe1", "name": "Pipeline Name"}
  ],
  "calendars": [
    {"id": "cal1", "name": "Calendar Name"}
  ],
  "workflow": [
    {"id": "wf1", "name": "Workflow Name", "type": "automation"}
  ],
  "forms": [
    {"id": "form1", "name": "Form Name"}
  ],
  "funnels": [
    {"id": "funnel1", "name": "Funnel Name"}
  ],
  "email_templates": [
    {"id": "email1", "name": "Email Template"}
  ],
  "dashboards": [
    {"id": "dash1", "name": "Dashboard Name"}
  ],
  "custom_objects": [
    {"id": "obj1", "name": "Object Schema Name"}
  ],
  "certificates": [
    {"id": "cert1", "name": "Certificate Name"}
  ],
  "conversation_ai": [
    {"id": "ai1", "name": "AI Agent Name"}
  ],
  "knowledge_bases": [
    {"id": "kb1", "name": "Knowledge Base Name"}
  ],
  "quizzes": [
    {"id": "quiz1", "name": "Quiz Name"}
  ],
  "membership_products": [
    {"id": "prod1", "name": "Product Name"}
  ],
  "review_settings": [
    {"id": "rev1", "name": "Review Settings"}
  ]
}
```

**Asset Categories Available**:
- `folders` - Media folders
- `custom_fields` - Custom contact/company fields
- `custom_values` - Custom field values
- `tags` - Contact tags
- `links` - Trigger links
- `text_templates` - SMS/text templates
- `surveys` - Survey forms
- `pipelines` - Opportunity pipelines
- `teams` - User teams
- `calendars` - Calendar configurations
- `campaigns` - Email campaigns (deprecated)
- `membership_offers` - Membership offers
- `membership_products` - Membership products
- `triggers` - Trigger configurations (deprecated)
- `workflow` - Automation workflows
- `social_planner` - Social media posts
- `forms` - Web forms
- `knowledge_bases` - AI knowledge bases
- `quizzes` - Quiz forms
- `email_templates` - Email templates
- `dashboards` - Custom dashboards
- `custom_objects` - Custom object schemas
- `certificates` - Certificate templates
- `review_settings` - Review request settings
- `funnels` - Funnel/website pages
- `conversation_ai` - Conversation AI agents

---

### 4. Get Snapshot Versions

**Endpoint**: `GET /snapshots/snapshot-versions/{snapshotId}`

**Description**: Retrieves version history of a snapshot

**Query Parameters**:
- `companyId` (required): Company ID
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20)

**Example**:
```
GET https://backend.leadconnectorhq.com/snapshots/snapshot-versions/uTwVJ3PkF5HRM5oxCpL1?companyId=3WEvz5mHuGnbYw1odUaF&page=1&limit=20
```

**Response Structure**:
```json
{
  "items": [
    {
      "_id": "versionId",
      "snapshotId": "uTwVJ3PkF5HRM5oxCpL1",
      "version": "1.2.0",
      "dateCreated": "ISO-8601 timestamp",
      "createdBy": "userId",
      "changelog": "Version notes"
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 20,
  "pages": 1
}
```

---

### 5. Get Snapshot Assets Status

**Endpoint**: `GET /snapshots/{snapshotId}/assets-status`

**Description**: Retrieves the status of asset dehydration/processing

**Query Parameters**:
- `companyId` (required): Company ID

**Example**:
```
GET https://backend.leadconnectorhq.com/snapshots/uTwVJ3PkF5HRM5oxCpL1/assets-status?companyId=3WEvz5mHuGnbYw1odUaF
```

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "status": "completed|processing|failed",
    "calendars": true,
    "campaigns": true,
    "certificates": true,
    "customFields": true,
    "forms": true,
    "funnels": true,
    "workflow": true,
    "emailTemplates": true
  }
}
```

---

### 6. Get Snapshot Preferences

**Endpoint**: `GET /snapshots/{snapshotId}/snapshot-preferences`

**Description**: Retrieves snapshot sharing and configuration preferences

**Query Parameters**:
- `companyId` (required): Company ID

**Example**:
```
GET https://backend.leadconnectorhq.com/snapshots/uTwVJ3PkF5HRM5oxCpL1/snapshot-preferences?companyId=3WEvz5mHuGnbYw1odUaF
```

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "isPublic": false,
    "shareWith": ["companyId1", "companyId2"],
    "allowDownload": true,
    "requireApproval": false
  }
}
```

---

### 7. Get Location Assets (Paginated)

**Endpoint**: `GET /snapshots/location-assets/{snapshotId}`

**Description**: Retrieves detailed asset data with pagination

**Query Parameters**:
- `page` (required): Page number
- `take` (required): Results per page
- `q` (optional): Search query
- `companyId` (required): Company ID

**Example**:
```
GET https://backend.leadconnectorhq.com/snapshots/location-assets/uTwVJ3PkF5HRM5oxCpL1?page=1&take=20&q=&companyId=3WEvz5mHuGnbYw1odUaF
```

**Response Structure**:
```json
{
  "data": [
    {
      "type": "workflow|form|funnel|etc",
      "id": "assetId",
      "name": "Asset Name",
      "dateAdded": "ISO-8601 timestamp",
      "dateUpdated": "ISO-8601 timestamp"
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "take": 20
  }
}
```

---

### 8. Get Snapshot Templates

**Endpoint**: `GET /snapshots/snapshot-templates/list`

**Description**: Retrieves available snapshot templates from the marketplace

**Query Parameters**:
- `companyId` (required): Company ID
- `skip` (optional): Pagination offset
- `limit` (optional): Results limit
- `q` (optional): Search query

**Example**:
```
GET https://backend.leadconnectorhq.com/snapshots/snapshot-templates/list?companyId=3WEvz5mHuGnbYw1odUaF&skip=0&limit=20&q=
```

**Response Structure**:
```json
[
  {
    "_id": "templateId",
    "name": "Template Name",
    "category": "Industry Category",
    "overview": "Template description",
    "snapshotUrl": "URL to snapshot",
    "imageUrl": "Preview image URL",
    "setupUrl": "Setup guide URL",
    "version": "1.0.0",
    "deleted": false,
    "createdAt": "ISO-8601 timestamp"
  }
]
```

---

### 9. Get Share Accounts

**Endpoint**: `GET /snapshots/list/share-accounts/v2`

**Description**: Retrieves list of companies/accounts this snapshot is shared with

**Query Parameters**:
- `companyId` (required): Company ID
- `skip` (optional): Pagination offset
- `limit` (optional): Results limit

**Example**:
```
GET https://backend.leadconnectorhq.com/snapshots/list/share-accounts/v2?companyId=3WEvz5mHuGnbYw1odUaF&skip=0&limit=20
```

**Response Structure**:
```json
{
  "shareAccounts": [
    {
      "companyId": "sharedCompanyId",
      "companyName": "Company Name",
      "dateShared": "ISO-8601 timestamp",
      "permissions": ["view", "copy"]
    }
  ],
  "totalCount": 5
}
```

---

## Supporting Endpoints

### Get Company Details

**Endpoint**: `GET /companies/{companyId}`

**Query Parameters**:
- None (companyId in path)

**Example**:
```
GET https://backend.leadconnectorhq.com/companies/3WEvz5mHuGnbYw1odUaF
```

**Response**: Company information including name, logo, plan, settings, etc.

---

### Get Company Feature Flags

**Endpoint**: `GET /companies/{companyId}/labs/featureFlags`

**Example**:
```
GET https://backend.leadconnectorhq.com/companies/3WEvz5mHuGnbYw1odUaF/labs/featureFlags
```

**Response**: Feature flag settings for the company

---

## How to Build Snapshot Documentation

### Step 1: Authenticate
```bash
POST https://backend.leadconnectorhq.com/oauth/2/login/token
# Get JWT tokens
```

### Step 2: Get Snapshot List
```bash
GET /snapshots/v2/{companyId}?type=own&skip=0&limit=20
# Find your snapshot ID
```

### Step 3: Get Snapshot Details
```bash
GET /snapshots/snapshotDetails/{snapshotId}?companyId={companyId}
# Get metadata and asset paths
```

### Step 4: Get Asset Summary
```bash
GET /snapshots-appengine/snapshot/{snapshotId}/get_assets?type=own&companyId={companyId}
# Get all asset names and IDs grouped by type
```

### Step 5: Get Detailed Assets (Optional)
```bash
GET /snapshots/location-assets/{snapshotId}?page=1&take=100&companyId={companyId}
# Get paginated detailed asset information
```

### Step 6: Get Asset Status
```bash
GET /snapshots/{snapshotId}/assets-status?companyId={companyId}
# Check which assets are available/processed
```

---

## Example: Building a Complete Snapshot Export

```python
import requests

BASE_URL = "https://backend.leadconnectorhq.com"
COMPANY_ID = "your-company-id"
SNAPSHOT_ID = "your-snapshot-id"
AUTH_TOKEN = "your-jwt-token"

headers = {
    "Authorization": f"Bearer {AUTH_TOKEN}",
    "Content-Type": "application/json"
}

# 1. Get snapshot details
snapshot_detail = requests.get(
    f"{BASE_URL}/snapshots/snapshotDetails/{SNAPSHOT_ID}",
    params={"companyId": COMPANY_ID},
    headers=headers
).json()

# 2. Get all assets summary
assets = requests.get(
    f"{BASE_URL}/snapshots-appengine/snapshot/{SNAPSHOT_ID}/get_assets",
    params={"type": "own", "companyId": COMPANY_ID},
    headers=headers
).json()

# 3. Build documentation
documentation = {
    "snapshot_id": SNAPSHOT_ID,
    "snapshot_name": snapshot_detail.get("name"),
    "date_created": snapshot_detail.get("dateAdded"),
    "asset_summary": {
        "total_workflows": len(assets.get("workflow", [])),
        "total_forms": len(assets.get("forms", [])),
        "total_funnels": len(assets.get("funnels", [])),
        "total_calendars": len(assets.get("calendars", [])),
        "total_custom_fields": len(assets.get("custom_fields", [])),
        "total_tags": len(assets.get("tags", [])),
        "total_pipelines": len(assets.get("pipelines", [])),
        "total_email_templates": len(assets.get("email_templates", [])),
        "total_surveys": len(assets.get("surveys", [])),
        "total_quizzes": len(assets.get("quizzes", [])),
        "total_dashboards": len(assets.get("dashboards", [])),
        "total_custom_objects": len(assets.get("custom_objects", [])),
        "total_ai_agents": len(assets.get("conversation_ai", [])),
        "total_knowledge_bases": len(assets.get("knowledge_bases", [])),
    },
    "assets_detail": assets
}

# Save to file
import json
with open(f"snapshot_{SNAPSHOT_ID}_documentation.json", "w") as f:
    json.dump(documentation, indent=2)
```

---

## Key Endpoints Summary for Snapshot Documentation

| Endpoint | Purpose | Required For Documentation |
|----------|---------|----------------------------|
| `GET /snapshots/v2/{companyId}` | List snapshots | ✅ Find snapshot ID |
| `GET /snapshots/snapshotDetails/{snapshotId}` | Snapshot metadata | ✅ Core info |
| `GET /snapshots-appengine/snapshot/{snapshotId}/get_assets` | Asset summary | ✅ Asset counts & names |
| `GET /snapshots/snapshot-versions/{snapshotId}` | Version history | ⭕ Optional |
| `GET /snapshots/{snapshotId}/assets-status` | Asset processing status | ⭕ Optional |
| `GET /snapshots/{snapshotId}/snapshot-preferences` | Share settings | ⭕ Optional |
| `GET /snapshots/location-assets/{snapshotId}` | Detailed paginated assets | ⭕ Optional (for full export) |
| `GET /companies/{companyId}` | Company details | ⭕ Optional context |

---

## Notes

1. **Snapshot ID**: The ID `uTwVJ3PkF5HRM5oxCpL1` from your export filename is used in the path
2. **Company ID**: Required in query params for most endpoints
3. **Authentication**: All endpoints require valid JWT token
4. **Pagination**: Most list endpoints support `skip`/`limit` or `page`/`take` parameters
5. **Asset Data Paths**: The actual asset data is stored in GCS paths listed in `assetDataPaths`

---

This documentation is based on actual API endpoints captured from `backend.leadconnectorhq.com` traffic analysis.
