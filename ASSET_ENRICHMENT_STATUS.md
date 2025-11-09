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

### Simple Configuration Assets:
1. **Custom Fields** - No individual endpoint found
2. **Custom Values** - No individual endpoint found
3. **Tags** - No individual endpoint found

### Marketing & Communication:
4. **Campaigns** - No individual endpoint found in API logger
5. **Text Templates** - No individual endpoint found

### Site & Content:
7. **Links** - No individual endpoint found
8. **Section Templates** - No individual endpoint found

### Organization:
9. **Folders** - No individual endpoint found
10. **Teams** - No individual endpoint found

### Membership:
11. **Membership Offers** - No individual endpoint found
12. **Membership Products** - No individual endpoint found

### Advanced Features:
13. **Triggers** - No individual endpoint found
14. **Knowledge Bases** - No individual endpoint found
15. **Quizzes** - No individual endpoint found
16. **Dashboards** - No individual endpoint found
17. **Custom Objects** - No individual endpoint found (only list endpoint)
18. **Certificates** - No individual endpoint found
19. **Review Settings** - No individual endpoint found
20. **Conversation AI** - No individual endpoint found
21. **Social Planner** - No individual endpoint found

## Recommendations for Future Enrichment

### Medium Priority (Need API Investigation):
- **Campaigns** - May have endpoint, needs testing
- **Text Templates** - May have endpoint similar to Email Templates
- **Knowledge Bases** - May have endpoint for new feature

### Low Priority (Likely No Individual Endpoints):
- Most configuration assets (tags, custom fields, etc.) don't have individual endpoints
- These assets are typically simple enough that the snapshot data is sufficient

## Summary Statistics

- **Total Asset Types**: 27
- **With Enrichment**: 7 (26%)
- **Without Enrichment**: 20 (74%)
- **Could Be Enriched**: 0 confirmed (others need API investigation)

## Notes

- The enriched assets are typically the most complex ones that benefit from detailed information
- Simple configuration assets (tags, custom fields) likely don't need enrichment
- The API logger data was analyzed from: `api-logger-export-2025-11-09T18-14-05-185Z.csv` (9.4MB)
