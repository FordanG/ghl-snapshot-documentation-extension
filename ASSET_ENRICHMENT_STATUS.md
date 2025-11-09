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

### 7. **Surveys**
- **Endpoint**: `/surveys/{surveyId}`
- **Additional Info**: Submission type/URL, thank you URL, pixel ID, total pages, total questions, submission settings
- **Code Location**: snapshot-exporter.js:2136-2186 (`enrichSurveys`)

### 8. **Campaigns** ✨ NEW!
- **Endpoint**: `/emails/campaigns/?locationId={id}&offset=0&limit=1000&search=`
- **Additional Info**: Total sent, opens, clicks, bounces, open rate, click rate, bounce rate, status, last sent date, workflow IDs
- **Code Location**: snapshot-exporter.js:2188-2268 (`enrichCampaigns`)

### 9. **Links** ✨ NEW!
- **Endpoint**: `/links/search?locationId={id}&skip=0&limit=1000`
- **Additional Info**: Full URL, short URL, click count, unique clicks, trigger information, trigger actions, workflow IDs
- **Code Location**: snapshot-exporter.js:2270-2346 (`enrichLinks`)

### 10. **Text Templates (Snippets)** ✨ NEW!
- **Endpoint**: `/snippets/{locationId}?skip=0&limit=1000`
- **Additional Info**: Body preview, character count, word count, attachments, folder structure
- **Code Location**: snapshot-exporter.js:2348-2423 (`enrichTextTemplates`)

### 11. **Membership Offers** ✨ NEW!
- **Endpoint**: Multiple endpoints - `/membership/smart-list/offers-products/{locationId}`, `/membership/locations/{id}/products`, `/membership/locations/{id}/settings/site-info`
- **Additional Info**: Pricing details, currency, billing cycle, product associations, site domain, site name, status
- **Code Location**: snapshot-exporter.js:2425-2529 (`enrichMembershipOffers`)

### 12. **Custom Fields** ✨ NEW!
- **Endpoint**: `/locations/{locationId}/customFields/search?model=all&limit=1000&includeStandards=false`
- **Additional Info**: Data type, field type, model associations, folder structure, field properties (required, unique, searchable), dropdown options, placeholder
- **Code Location**: snapshot-exporter.js:2595-2676 (`enrichCustomFields`)

### 13. **Custom Values** ✨ NEW!
- **Endpoint**: `/locations/{locationId}/customValues/`
- **Additional Info**: Value details, type, category, description, active status, metadata
- **Code Location**: snapshot-exporter.js:2678-2747 (`enrichCustomValues`)

### 14. **Tags** ✨ NEW!
- **Endpoint**: `/locations/{locationId}/tags`
- **Additional Info**: Color, usage statistics (contact count, opportunity count, total usage), category, description, creation date, last used date
- **Code Location**: snapshot-exporter.js:2749-2825 (`enrichTags`)

### 15. **Knowledge Bases** ✨ NEW!
- **Endpoint**: `/knowledge-base/all?locationId={id}`, `/knowledge-base/{knowledgeBaseId}`, `/knowledge-base/files/all?knowledgeBaseId={id}`
- **Additional Info**: Files, file types, file size, content statistics, website/rich text content indicators
- **Code Location**: snapshot-exporter.js:2875-2978 (`enrichKnowledgeBases`)

### 16. **Conversation AI** ✨ NEW!
- **Endpoint**: `/ai-employees/employees/search?limit=1000&locationId={id}`
- **Additional Info**: Bot configuration, goal/prompt details, actions, channels, knowledge base associations, wait/sleep settings
- **Code Location**: snapshot-exporter.js:2980-3074 (`enrichConversationAI`)

### 17. **Custom Objects** ✨ NEW!
- **Endpoint**: `/objects/?locationId={id}`
- **Additional Info**: Schema details, field configurations, field types, required fields, system/enabled status
- **Code Location**: snapshot-exporter.js:3076-3205 (`enrichCustomObjects`)

### 18. **Dashboards** ✨ NEW!
- **Endpoint**: `/reporting/dashboards?locationId={id}`, `/reporting/dashboards/{dashboardId}?locationId={id}`, `/reporting/dashboards/{dashboardId}/permissions?locationId={id}`
- **Additional Info**: Widget configurations, widget types, layout, sharing/permissions, visibility settings
- **Code Location**: snapshot-exporter.js:3207-3313 (`enrichDashboards`)

### 19. **Quizzes** ✨ NEW!
- **Endpoint**: `/forms/?locationId={id}&type=folder&productType=quiz`, `/forms/{formId}` (uses Forms API)
- **Additional Info**: Same enrichment as Forms (submission type, URLs, field types, payment requirements)
- **Code Location**: snapshot-exporter.js:1993-2043 (`enrichForms` - shared with Forms)
- **Note**: Quizzes use the same API as Forms, just with a product type filter

## Assets WITHOUT Enrichment (Basic Export Only) ⚠️

These assets use ONLY the data from the snapshot endpoint - no additional API calls:

### Assets WITH List Endpoints (Potential for Future Enrichment) 🔍

These assets have API endpoints available that could be used for enrichment:

#### Medium Priority:
1. **Membership Products** - Endpoint found: `/membership/locations/{id}/products`
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

#### Site & Content:
7. **Section Templates** - No individual endpoint found

#### Organization:
8. **Folders** - No individual endpoint found
9. **Teams** - No individual endpoint found

#### Advanced Features:
10. **Triggers** - List endpoint only (`/triggers/`)
11. **Certificates** - No individual endpoint found
12. **Review Settings** - No individual endpoint found

## Detailed Findings from API Log Analysis

### Analysis Date: 2025-11-09
**Files Analyzed**: 10 CSV files (~70MB of API logs)
**Unique Endpoints Discovered**: 50+
**Actionable Enrichment Opportunities**: 5

### Key Discoveries:

1. **Campaigns Endpoint** ✅ **IMPLEMENTED**
   - `GET /emails/campaigns/?locationId={id}&offset=0&limit=10&search=`
   - Provides: Campaign stats, status, send history
   - **Status**: ✅ Enrichment implemented - See `enrichCampaigns` function

2. **Links/Trigger Links Endpoints** ✅ **IMPLEMENTED**
   - `GET /links/?locationId={id}`
   - `GET /links/search?locationId={id}&skip=0&limit=1000`
   - Provides: URLs, click stats, trigger configurations
   - **Status**: ✅ Enrichment implemented - See `enrichLinks` function

3. **Snippets (Text Templates) Endpoint** ✅ **IMPLEMENTED**
   - `GET /snippets/{locationId}?skip=0&limit=10`
   - Provides: Template content, folders, attachments
   - **Status**: ✅ Enrichment implemented - See `enrichTextTemplates` function

4. **Membership Endpoints** ✅ **IMPLEMENTED**
   - `GET /membership/locations/{id}/products`
   - `GET /membership/smart-list/offers-products/{id}`
   - `GET /membership/locations/{id}/settings/builder-settings`
   - `GET /membership/locations/{id}/settings/site-info`
   - Provides: Products, offers, site configuration
   - **Status**: ✅ Enrichment implemented - See `enrichMembershipOffers` function

5. **Social Planner Endpoints** ✅
   - `GET /social-media-posting/{id}/accounts?fetchAll=true`
   - `GET /reporting/.../social-planner/integration-status?platform={platform}`
   - Provides: Connected accounts, integration status per platform
   - **Recommendation**: Low priority - mostly status data

### Assets Confirmed WITHOUT Individual Endpoints:
- Triggers, Folders, Teams, Section Templates, Quizzes, Dashboards, etc.
- These assets rely entirely on snapshot data
- No enrichment possible without individual detail endpoints

### ✅ Assets Previously Without Enrichment - NOW ENRICHED:
- **Custom Fields** - Now enriched with folder structure, model associations, field properties
- **Custom Values** - Now enriched with value details, categories, metadata
- **Tags** - Now enriched with usage statistics (contact/opportunity counts)

## Enrichment Implementation Status

### ✅ Phase 1: High-Value Enrichments - **COMPLETED**
1. ✅ **Campaigns** - Marketing effectiveness tracking
   - **Status**: IMPLEMENTED
   - **Implementation**: `enrichCampaigns` function
   - **Value**: HIGH - Provides marketing ROI insights with open rates, click rates, bounce rates

2. ✅ **Links** - Click tracking and conversion analysis
   - **Status**: IMPLEMENTED
   - **Implementation**: `enrichLinks` function
   - **Value**: HIGH - Essential campaign effectiveness with click tracking and trigger analytics

### ✅ Phase 2: Medium-Value Enrichments - **COMPLETED**
3. ✅ **Membership Offers** - Revenue asset details
   - **Status**: IMPLEMENTED
   - **Implementation**: `enrichMembershipOffers` function
   - **Value**: MEDIUM - Revenue tracking with pricing, products, site configuration

4. ✅ **Text Templates** - Content organization and usage
   - **Status**: IMPLEMENTED
   - **Implementation**: `enrichTextTemplates` function
   - **Value**: MEDIUM - Team productivity with content preview, character counts, folder structure

### Phase 3: Low-Priority Enrichments (Consider for Future)
5. **Social Planner** - Integration status overview
   - **Effort**: 3-4 hours
   - **Value**: LOW - Primarily configuration data
   - **Recommendation**: Implement only if user demand increases

6. **Membership Products** - Individual product details
   - **Effort**: 2-3 hours
   - **Value**: LOW - Most data available through Membership Offers enrichment
   - **Recommendation**: May not add significant value beyond existing enrichment

### Not Recommended (Still No Enrichment):
- Assets without individual endpoints (Triggers, Folders, Teams, etc.)
- These assets have sufficient data in the snapshot already
- No additional API calls would provide meaningful value

### ✅ Previously "Not Recommended" - NOW IMPLEMENTED:
- Custom Fields, Custom Values, Tags - Now enriched with valuable organizational and usage data!

## Summary Statistics

- **Total Asset Types**: 27
- **With Enrichment**: 19 (70%) ⬆️ +12 newly implemented!
  - **Previously Enriched (7)**: Workflows, Forms, Funnels, Calendars, Pipelines, Email Templates, Surveys
  - **Phase 1 & 2 (4)**: Campaigns, Links, Text Templates, Membership Offers
  - **Configuration Assets (3)**: Custom Fields, Custom Values, Tags
  - **AI & Content Assets (3)**: Knowledge Bases, Conversation AI, Custom Objects
  - **Reporting & Forms (2)**: Dashboards, Quizzes
- **Without Enrichment**: 8 (30%)
  - **With Available Endpoints**: 2 (7%) - Membership Products, Social Planner (low priority)
  - **Without Endpoints**: 6 (22%) - No enrichment possible
- **Implementation Progress**: Phase 1, Phase 2, Configuration, AI/Content & Reporting Assets complete! ✅

## Notes

- The enriched assets are typically the most complex ones that benefit from detailed information
- Simple configuration assets (tags, custom fields) likely don't need enrichment
- **Original analysis**: `api-logger-export-2025-11-09T18-14-05-185Z.csv` (9.4MB)
- **Comprehensive analysis**: 10 CSV files analyzed on 2025-11-09 (~70MB total)
- **Detailed findings**: See `ENRICHMENT_APPROACHES.md` for implementation details and code examples

## Related Documentation

- **ENRICHMENT_APPROACHES.md** - Detailed implementation approaches for each asset type with code examples
- **README.md** - Main project documentation
