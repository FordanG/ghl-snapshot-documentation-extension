# GHL Snapshot Asset Enrichment Status

## Overview
This document tracks which snapshot assets have been enriched with additional information from their individual API endpoints.

## Assets WITH Enrichment ✅

These assets fetch additional detailed information beyond what's in the snapshot:

### 1. **Workflows**
- **Endpoint**: `/workflow/{locationId}/{workflowId}?includeScheduledPauseInfo=true`
- **Additional Info**: Full workflow data including templates, triggers, actions, custom fields used, tags used, SMS/email details, AI-generated description and setup notes
- **Code Location**: snapshot-exporter.js:1180-1432 (`enrichWorkflowsWithAI`)

### 2. **Forms**
- **Endpoint**: `/forms/{locationId}/{formId}`
- **Additional Info**: Submission type, URLs, pixel ID, field types, payment requirements
- **Code Location**: snapshot-exporter.js:1864-1911 (`enrichForms`)

### 3. **Funnels**
- **Endpoint**: `/funnels/{locationId}/{funnelId}`
- **Additional Info**: Domain, custom domain, tracking code, page count, page names, SEO details
- **Code Location**: snapshot-exporter.js:1916-1958 (`enrichFunnels`)

### 4. **Calendars**
- **Endpoint**: `/calendars/{locationId}/{calendarId}`
- **Additional Info**: Slug, appointment title, event type, meeting location, slot settings, conferencing providers
- **Code Location**: snapshot-exporter.js:1964-2014 (`enrichCalendars`)

### 5. **Pipelines**
- **Endpoint**: `/opportunities/pipelines/{locationId}/{pipelineId}`
- **Additional Info**: Stage count, stage names, first/last stage, funnel/contact visibility settings
- **Code Location**: snapshot-exporter.js:2020-2063 (`enrichPipelines`)

### 6. **Email Templates**
- **Endpoint**: `/templates/{locationId}/{templateId}`
- **Additional Info**: Subject, from name/email, reply-to, custom fields used, attachments
- **Code Location**: snapshot-exporter.js:2069-2130 (`enrichEmailTemplates`)

### 7. **Surveys** ✨ NEW!
- **Endpoint**: `/surveys/{surveyId}`
- **Additional Info**: Submission type/URL, thank you URL, pixel ID, total pages, total questions, submission settings
- **Code Location**: snapshot-exporter.js:2136-2186 (`enrichSurveys`)

## Assets WITHOUT Enrichment (Basic Export Only) ⚠️

These assets use ONLY the data from the snapshot endpoint - no additional API calls:

### Assets WITH List Endpoints (Potential for Future Enrichment) 🔍

These assets have API endpoints available that could be used for enrichment:

#### High Priority:
1. **Campaigns** - List endpoint found: `/emails/campaigns/`
   - **Status**: List endpoint available, no individual endpoint
   - **Potential**: Campaign statistics (opens, clicks, sends), status, associated workflows
   - **Priority**: HIGH - Marketing effectiveness data

2. **Links** - Multiple endpoints found: `/links/`, `/links/search`
   - **Status**: List and search endpoints available
   - **Potential**: Click statistics, trigger actions, associated workflows
   - **Priority**: HIGH - Campaign tracking data

#### Medium Priority:
3. **Text Templates** - Endpoint found: `/snippets/{locationId}`
   - **Status**: List endpoint available with folder support
   - **Potential**: Template content preview, character count, folder structure
   - **Priority**: MEDIUM - Content organization data

4. **Membership Offers** - Multiple endpoints found: `/membership/locations/{id}/products`, `/membership/smart-list/offers-products/`
   - **Status**: List and settings endpoints available
   - **Potential**: Pricing details, site settings, domain configuration
   - **Priority**: MEDIUM - Revenue tracking data

5. **Membership Products** - Endpoint found: `/membership/locations/{id}/products`
   - **Status**: List endpoint available
   - **Potential**: Product details, pricing, associations
   - **Priority**: MEDIUM - Revenue tracking data

#### Low Priority:
6. **Social Planner** - Multiple endpoints found: `/social-media-posting/{id}/accounts`, integration status per platform
   - **Status**: Integration status and account list endpoints available
   - **Potential**: Connected platforms, account status, posting settings
   - **Priority**: LOW - Mostly configuration data

### Assets WITHOUT Individual Endpoints (No Enrichment Possible) ❌

These assets only have list endpoints or no specific endpoints at all:

#### Simple Configuration Assets:
7. **Custom Fields** - List endpoint only (`/customFields/search`)
8. **Custom Values** - List endpoint only (`/custom-data/social-media`)
9. **Tags** - No individual endpoint found

#### Site & Content:
10. **Section Templates** - No individual endpoint found

#### Organization:
11. **Folders** - No individual endpoint found
12. **Teams** - No individual endpoint found

#### Advanced Features:
13. **Triggers** - List endpoint only (`/triggers/`)
14. **Knowledge Bases** - No individual endpoint found in current logs
15. **Quizzes** - No individual endpoint found
16. **Dashboards** - No individual endpoint found
17. **Custom Objects** - List endpoint only (user-defined schemas)
18. **Certificates** - No individual endpoint found
19. **Review Settings** - No individual endpoint found
20. **Conversation AI** - No individual endpoint found in current logs
21. **Knowledge Base** - No individual endpoint found in current logs

## Detailed Findings from API Log Analysis

### Analysis Date: 2025-11-09
**Files Analyzed**: 10 CSV files (~70MB of API logs)
**Unique Endpoints Discovered**: 50+
**Actionable Enrichment Opportunities**: 5

### Key Discoveries:

1. **Campaigns Endpoint** ✅
   - `GET /emails/campaigns/?locationId={id}&offset=0&limit=10&search=`
   - Provides: Campaign stats, status, send history
   - **Recommendation**: Implement enrichment for campaign analytics

2. **Links/Trigger Links Endpoints** ✅
   - `GET /links/?locationId={id}`
   - `GET /links/search?locationId={id}&skip=0&limit=1000`
   - Provides: URLs, click stats, trigger configurations
   - **Recommendation**: Implement enrichment for link tracking

3. **Snippets (Text Templates) Endpoint** ✅
   - `GET /snippets/{locationId}?skip=0&limit=10`
   - Provides: Template content, folders, attachments
   - **Recommendation**: Consider enrichment for content management

4. **Membership Endpoints** ✅
   - `GET /membership/locations/{id}/products`
   - `GET /membership/smart-list/offers-products/{id}`
   - `GET /membership/locations/{id}/settings/builder-settings`
   - `GET /membership/locations/{id}/settings/site-info`
   - Provides: Products, offers, site configuration
   - **Recommendation**: Implement enrichment for revenue tracking

5. **Social Planner Endpoints** ✅
   - `GET /social-media-posting/{id}/accounts?fetchAll=true`
   - `GET /reporting/.../social-planner/integration-status?platform={platform}`
   - Provides: Connected accounts, integration status per platform
   - **Recommendation**: Low priority - mostly status data

### Assets Confirmed WITHOUT Individual Endpoints:
- Triggers, Custom Fields, Custom Values, Tags, Folders, Teams
- These assets rely entirely on snapshot data
- No enrichment possible without individual detail endpoints

## Recommendations for Future Enrichment

### Phase 1: High-Value Enrichments (Recommended Implementation)
1. **Campaigns** - Marketing effectiveness tracking
   - **Effort**: 4-6 hours
   - **Value**: HIGH - Critical for marketing ROI insights

2. **Links** - Click tracking and conversion analysis
   - **Effort**: 3-4 hours
   - **Value**: HIGH - Essential for campaign effectiveness

### Phase 2: Medium-Value Enrichments (Consider Based on User Demand)
3. **Membership Offers/Products** - Revenue asset details
   - **Effort**: 5-7 hours
   - **Value**: MEDIUM - Important for revenue tracking

4. **Text Templates** - Content organization and usage
   - **Effort**: 2-3 hours
   - **Value**: MEDIUM - Useful for team productivity

### Phase 3: Low-Priority Enrichments (Optional)
5. **Social Planner** - Integration status overview
   - **Effort**: 3-4 hours
   - **Value**: LOW - Primarily configuration data

### Not Recommended:
- Assets without individual endpoints (Triggers, Custom Fields, Tags, etc.)
- These assets have sufficient data in the snapshot already
- No additional API calls would provide meaningful value

## Summary Statistics

- **Total Asset Types**: 27
- **With Enrichment**: 7 (26%)
- **Without Enrichment**: 20 (74%)
  - **With Available Endpoints**: 6 (23%) - Campaigns, Links, Text Templates, Membership Offers, Membership Products, Social Planner
  - **Without Endpoints**: 14 (51%) - No enrichment possible
- **Recommended for Implementation**: 2 (Campaigns, Links) - High business value

## Notes

- The enriched assets are typically the most complex ones that benefit from detailed information
- Simple configuration assets (tags, custom fields) likely don't need enrichment
- **Original analysis**: `api-logger-export-2025-11-09T18-14-05-185Z.csv` (9.4MB)
- **Comprehensive analysis**: 10 CSV files analyzed on 2025-11-09 (~70MB total)
- **Detailed findings**: See `ENRICHMENT_APPROACHES.md` for implementation details and code examples

## Related Documentation

- **ENRICHMENT_APPROACHES.md** - Detailed implementation approaches for each asset type with code examples
- **README.md** - Main project documentation
