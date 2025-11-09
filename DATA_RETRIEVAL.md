# Super Snapshots AI - Data Retrieval Documentation

## Overview

This extension retrieves and documents **27+ asset types** from GoHighLevel snapshots with **70% deep enrichment** (19 of 27 assets receive additional API enrichment beyond basic snapshot data).

---

## What Data Is Retrieved

### 📊 Current Data Retrieval Capabilities

The extension accesses data through **50+ API endpoints** to provide comprehensive snapshot documentation:

#### **Core Configuration Assets**
| Asset Type | Basic Export | Enriched | Key Data Retrieved |
|-----------|-------------|----------|-------------------|
| Custom Fields | ✅ | ✅ | Field definitions, data types, model associations, dropdown options, folder organization |
| Custom Values | ✅ | ✅ | Custom value configurations |
| Tags | ✅ | ✅ | Tag definitions, colors, usage statistics (contact counts, opportunity counts) |
| Pipelines | ✅ | ✅ | Pipeline configurations with stages, visibility settings, funnel associations |
| Folders | ✅ | ❌ | Organizational folder structure |
| Teams | ✅ | ❌ | Team configurations |

#### **Communication & Automation Assets**
| Asset Type | Basic Export | Enriched | Key Data Retrieved |
|-----------|-------------|----------|-------------------|
| Workflows | ✅ | ✅ ⭐ | Complete workflow definitions with **AI-generated descriptions**, triggers, actions, conditions, SMS/email counts, tag usage, custom field usage, active hours |
| Triggers | ✅ | ❌ | Automation trigger configurations |
| Campaigns | ✅ | ✅ | Email campaigns with detailed statistics (opens, clicks, bounces, unsubscribes) |
| Email Templates | ✅ | ✅ | Email template designs, HTML content, configurations |
| Text Templates | ✅ | ✅ | SMS/text message templates (snippets) |

#### **Forms & Surveys**
| Asset Type | Basic Export | Enriched | Key Data Retrieved |
|-----------|-------------|----------|-------------------|
| Forms | ✅ | ✅ | Form builders, fields, submission types, URLs, pixel tracking, payment requirements |
| Surveys | ✅ | ✅ | Survey configurations and questions |
| Quizzes | ✅ | ✅ | Quiz configurations (uses Forms API) |

#### **Pages & Content**
| Asset Type | Basic Export | Enriched | Key Data Retrieved |
|-----------|-------------|----------|-------------------|
| Funnels | ✅ | ✅ | Funnel pages and websites with domain configurations |
| Links | ✅ | ✅ | Tracking links with click statistics and trigger associations |
| Calendars | ✅ | ✅ | Calendar configurations with availability, booking settings, conferencing providers |
| Section Templates | ✅ | ❌ | Reusable section templates |

#### **Membership & Revenue**
| Asset Type | Basic Export | Enriched | Key Data Retrieved |
|-----------|-------------|----------|-------------------|
| Membership Offers | ✅ | ✅ | Offer configurations with pricing and product associations |
| Membership Products | ✅ | ❌ | Product details (covered by Offers enrichment) |
| Certificates | ✅ | ❌ | Certificate templates |

#### **Advanced Features**
| Asset Type | Basic Export | Enriched | Key Data Retrieved |
|-----------|-------------|----------|-------------------|
| Knowledge Bases | ✅ | ✅ | Knowledge base content with files, categories, and usage statistics |
| Conversation AI | ✅ | ✅ | AI assistant configurations, prompts, and personas |
| Custom Objects | ✅ | ✅ | Custom object schemas and field definitions |
| Dashboards | ✅ | ✅ | Dashboard layouts with widget configurations and permissions |
| Social Planner | ✅ | ❌ | Social media planning content |
| Review Settings | ✅ | ❌ | Review collection settings |

⭐ **Most Comprehensive**: Workflows receive the deepest enrichment with 31+ data columns including AI analysis

---

## API Endpoints Used

### Primary Snapshot Endpoints

**Snapshot Assets:**
```
GET /snapshots-appengine/snapshot/{snapshotId}/get_assets?type=own&companyId={companyId}
```
Returns all basic snapshot asset data in a single call.

**Snapshot Metadata:**
```
GET /snapshots/snapshotDetails/{snapshotId}?companyId={companyId}
```
Retrieves snapshot metadata including locationId, name, created/updated dates.

**Snapshot List:**
```
GET /snapshots/v2/{companyId}?companyId={companyId}&skip=0&limit=20&type=own
```
Lists all available snapshots for dropdown selection.

### Enrichment Endpoints (19 Asset Types)

#### Workflows (with AI)
```
GET /workflow/{locationId}/{workflowId}?includeScheduledPauseInfo=true
POST https://api.openai.com/v1/chat/completions
```
Includes GPT-4o-mini AI analysis for workflow descriptions and setup instructions.

#### Forms & Surveys
```
GET /forms/{locationId}/{formId}
GET /surveys/{surveyId}
```

#### Funnels & Pages
```
GET /funnels/{locationId}/{funnelId}
```

#### Calendars
```
GET /calendars/{locationId}/{calendarId}
GET /calendars/configuration/location/{locationId}
```

#### Pipelines
```
GET /opportunities/pipelines/{locationId}/{pipelineId}
```

#### Email & Text Templates
```
GET /templates/{locationId}/{templateId}
GET /snippets/{locationId}?skip=0&limit=1000
```

#### Campaigns & Links
```
GET /emails/campaigns/?locationId={id}&offset=0&limit=1000
GET /links/search?locationId={id}&skip=0&limit=1000
```

#### Membership
```
GET /membership/locations/{id}/products
GET /membership/smart-list/offers-products/{id}
GET /membership/locations/{id}/settings/site-info
```

#### Custom Fields & Values
```
GET /locations/{id}/customFields/search?model=all&limit=1000
GET /locations/{id}/customValues/
GET /locations/{id}/tags
```

#### Knowledge Bases
```
GET /knowledge-base/all?locationId={id}
GET /knowledge-base/{kbId}
GET /knowledge-base/files/all?knowledgeBaseId={id}
```

#### Conversation AI
```
GET /ai-employees/employees/search?limit=1000&locationId={id}
```

#### Custom Objects & Dashboards
```
GET /objects/?locationId={id}
GET /reporting/dashboards?locationId={id}
GET /reporting/dashboards/{dashboardId}?locationId={id}
GET /reporting/dashboards/{dashboardId}/permissions?locationId={id}
```

---

## Export Formats

### Primary Format: Excel (.xlsx)

**Structure:**
- Single workbook with multiple sheets (one per asset type)
- Summary sheet with export metadata and asset counts
- Master list sheet combining all assets
- Custom column widths optimized for readability
- UTF-8 encoding for proper character support

**Example Workflow Sheet (31+ columns):**
- Name, Status, Version
- **AI Description** (generated by GPT-4o-mini)
- **AI Setup Notes** (generated by GPT-4o-mini)
- Triggers, Total Steps, Workflow Actions
- SMS Count, SMS Messages
- Email Count, Email Messages
- Conditions, Splits, Webhooks, API Calls
- Tags Used, Custom Fields Used
- Active Hours, Timezone
- Created/Updated dates

### Secondary Format: CSV

- Multiple CSV files (one per asset type)
- UTF-8 BOM for Excel compatibility
- Proper escaping of special characters
- Summary CSV with export metadata

---

## What Else Can Be Saved

### 🚀 High Priority Enhancements

#### 1. AI Analysis Expansion
**Currently:** Only workflows get AI analysis
**Potential:**
- **Forms:** AI analysis of field structure, user experience suggestions
- **Campaigns:** Marketing effectiveness insights, subject line analysis
- **Funnels:** Conversion optimization suggestions, UX analysis
- **Support for Multiple AI Providers:** Anthropic Claude, local models

#### 2. Asset Relationship Mapping
**Currently:** Assets documented independently
**Potential:**
- Map workflows to forms/calendars/pipelines they use
- Identify unused assets (forms with no submissions, unused tags)
- Create dependency graph (what breaks if X is removed)
- Visualize asset interconnections

#### 3. Performance Optimization
**Currently:** Sequential API calls can be slow
**Potential:**
- Connection pooling for API calls
- Request rate limiting/throttling
- Cache duplicate API requests
- Parallel processing for independent enrichments

#### 4. Export Format Enhancements
**Currently:** Excel and CSV only
**Potential:**
- JSON export format (for programmatic use)
- Selective export (choose specific asset types)
- Snapshot comparison mode (diff two snapshots)
- Visual workflow diagrams (Mermaid/GraphViz)
- HTML reports with interactive elements

### 📈 Medium Priority Features

#### 5. Usage Analytics
**Potential:**
- Workflow execution statistics (if API available)
- Track asset creation/modification dates
- Identify "hot spots" (most used assets)
- Asset usage patterns over time

#### 6. Documentation Generation
**Potential:**
- Auto-generate Markdown documentation
- Create clickable HTML reports
- Generate PDF documentation with images
- Interactive asset explorer

#### 7. Data Validation
**Potential:**
- Check for broken references (deleted forms in workflows)
- Validate webhook URLs
- Check for missing custom fields
- Identify orphaned assets

#### 8. Batch Operations
**Potential:**
- Export multiple snapshots at once
- Schedule automatic exports
- Export to cloud storage (Google Drive, Dropbox)
- Webhook notifications on export completion

### 🔮 Advanced Features (Future)

#### 9. Remaining Asset Enrichment
**Assets Without Full Enrichment (8 remaining):**
- Social Planner (connected accounts, posting statistics)
- Membership Products (individual product details)
- Folders, Teams, Section Templates
- Triggers (individual trigger details)
- Certificates, Review Settings

**Note:** Limited by available API endpoints

#### 10. Visual Documentation
**Potential:**
- Screenshot generation of funnels/pages
- Email template previews (rendered HTML)
- Workflow visualization (flowcharts)
- Asset usage heatmaps

#### 11. Advanced Analysis
**Potential:**
- Workflow complexity scoring
- Marketing funnel analysis
- Conversion rate predictions
- Asset usage patterns
- Tag co-occurrence analysis

#### 12. Integration Features
**Potential:**
- Export to project management tools (Notion, Asana)
- Integration with documentation platforms (Confluence)
- Webhook notifications on export completion
- API access for custom integrations

---

## Currently Unavailable (API Limitations)

These data points are **not currently available** through GoHighLevel APIs:

- Contact/lead counts per tag (partially available through enrichment)
- Workflow execution history/statistics
- Form submission history
- Campaign recipient lists
- Calendar booking history
- Real-time usage metrics
- Asset version history
- User activity logs

---

## Key Strengths

✅ **70% enrichment rate** (19 of 27 asset types deeply enriched)
✅ **AI-powered workflow documentation** with GPT-4o-mini
✅ **Comprehensive data extraction** from 50+ API endpoints
✅ **Professional Excel exports** with optimized formatting
✅ **Real-time progress tracking** during export
✅ **Automatic ID detection** from GHL URLs
✅ **Revex authentication integration** (no API keys needed)
✅ **Most comprehensive** GHL snapshot documentation tool available

---

## Summary

This extension provides the most comprehensive snapshot documentation available for GoHighLevel, with deep enrichment of 19 asset types and AI-powered analysis. The modular architecture makes it easy to add new enrichments as GHL expands its API capabilities.

**Export Time Estimates:**
- Small snapshot (< 50 assets): 2-5 minutes
- Medium snapshot (50-200 assets): 5-15 minutes
- Large snapshot (200+ assets): 15-45 minutes

*Export time depends on number of assets, enrichment depth, and API response times.*
