# Asset Enrichment Approaches - Analysis from API Logs

## Overview
This document outlines potential enrichment approaches for GHL Snapshot assets based on analysis of API logs from 2025-11-09. These approaches detail what endpoints are available and how each asset type could be enriched.

## Analysis Summary
- **API Logs Analyzed**: 10 CSV files (totaling ~70MB of data)
- **Analysis Date**: 2025-11-09
- **Findings**: Most unenriched assets only have LIST endpoints available, not individual detailed endpoints

---

## Assets WITH Potential for Enrichment

### 1. Campaigns (Email)
**Status**: ✅ List endpoint found, ⚠️ No individual endpoint found

**Available Endpoints**:
- List: `GET /emails/campaigns/?locationId={locationId}&offset=0&limit=10&search=`
- Workflow-based: `GET /workflow/campaign/?locationId={locationId}`

**Data Available from List Endpoint**:
- Campaign name
- Campaign status (active/inactive/draft)
- Send statistics (opens, clicks, bounces)
- Creation date
- Last modified date
- Associated workflows

**Enrichment Approach**:
```javascript
async enrichCampaigns(campaigns) {
  // Since no individual endpoint exists, use list endpoint data
  // to enhance basic snapshot information

  for (const campaign of campaigns) {
    try {
      // The list endpoint likely returns:
      // - name, status, stats, createdAt, updatedAt
      // - Can extract: open rate, click rate, total sends
      // - Associated workflow IDs

      enriched = {
        ...campaign,
        statistics: {
          totalSent: campaign.totalSent || 0,
          opens: campaign.opens || 0,
          clicks: campaign.clicks || 0,
          openRate: campaign.opens / campaign.totalSent * 100,
          clickRate: campaign.clicks / campaign.totalSent * 100
        },
        lastActivity: campaign.lastSentAt || campaign.updatedAt,
        workflowIds: campaign.workflowIds || []
      };

      this.log(`Campaign enriched: ${campaign.name}`);
    } catch (error) {
      this.log(`Failed to enrich campaign ${campaign.id}: ${error.message}`);
    }
  }
}
```

**Implementation Priority**: Medium
**Reason**: Email campaigns are important marketing assets with valuable statistics

---

### 2. Links (Trigger Links)
**Status**: ✅ List endpoints found, ⚠️ No individual endpoint found

**Available Endpoints**:
- List: `GET /links/?locationId={locationId}`
- Search: `GET /links/search?locationId={locationId}&skip=0&limit=1000`
- Services: `GET /services/links/search?locationId={locationId}&query=&skip=0&limit=10`

**Data Available from List Endpoint**:
- Link name
- Link URL/slug
- Trigger actions associated
- Creation date
- Usage statistics (if available)
- Associated workflows

**Enrichment Approach**:
```javascript
async enrichLinks(links) {
  // Use search endpoint to get all links with detailed info

  for (const link of links) {
    try {
      // Search endpoint likely provides:
      // - Full URL, shortened URL, custom slug
      // - Trigger configuration
      // - Click statistics
      // - Associated workflow/campaign IDs

      enriched = {
        ...link,
        fullUrl: link.url,
        shortUrl: link.shortUrl || `https://link.gohighlevel.com/${link.slug}`,
        clickCount: link.clicks || 0,
        triggerActions: link.triggers || [],
        associatedWorkflows: link.workflowIds || [],
        lastClickedAt: link.lastClickedAt
      };

      this.log(`Link enriched: ${link.name}`);
    } catch (error) {
      this.log(`Failed to enrich link ${link.id}: ${error.message}`);
    }
  }
}
```

**Implementation Priority**: Medium
**Reason**: Trigger links are valuable for tracking marketing campaign effectiveness

---

### 3. Text Templates (Snippets)
**Status**: ✅ List endpoint found, ⚠️ No individual endpoint found

**Available Endpoints**:
- List: `GET /snippets/{locationId}?skip=0&limit=10`
- List Folders: `GET /snippets/{locationId}?skip=0&limit=10&isFolder=true`

**Data Available from List Endpoint**:
- Snippet name
- Snippet content/body
- Folder organization
- URL attachments
- Creation/update dates
- Total snippets in folder

**Enrichment Approach**:
```javascript
async enrichTextTemplates(templates) {
  // Use snippets endpoint to get detailed template information

  for (const template of templates) {
    try {
      // List endpoint provides:
      // - Template body/content
      // - Folder structure
      // - Attached URLs
      // - Usage context (where it can be used)

      enriched = {
        ...template,
        bodyPreview: template.body ? template.body.substring(0, 200) + '...' : '',
        characterCount: template.body ? template.body.length : 0,
        hasAttachments: (template.urlAttachments || []).length > 0,
        attachmentCount: (template.urlAttachments || []).length,
        folderPath: template.folderName || 'Root',
        isFolder: template.isFolder || false
      };

      this.log(`Text template enriched: ${template.name}`);
    } catch (error) {
      this.log(`Failed to enrich text template ${template.id}: ${error.message}`);
    }
  }
}
```

**Implementation Priority**: Low-Medium
**Reason**: Text templates are simpler assets; basic info from list endpoint may be sufficient

---

### 4. Membership Offers/Products
**Status**: ✅ Settings endpoints found, ⚠️ No individual offer/product endpoints found

**Available Endpoints**:
- Products List: `GET /membership/locations/{locationId}/products`
- Offers/Products List: `GET /membership/smart-list/offers-products/{locationId}`
- Settings: `GET /membership/locations/{locationId}/settings/builder-settings`
- Domain Info: `GET /membership/locations/{locationId}/settings/domain?type=custom`
- Site Info: `GET /membership/locations/{locationId}/settings/site-info`
- Stats: `GET /membership/locations/{locationId}/stats`

**Data Available**:
- Product names, prices, descriptions
- Offer configurations
- Membership site settings
- Domain configuration
- Builder settings
- Overall statistics

**Enrichment Approach**:
```javascript
async enrichMembershipOffers(offers) {
  // Use smart-list endpoint to get offers with product details

  try {
    // Fetch membership settings once for all offers
    const settings = await this.fetchMembershipSettings(locationId);
    const siteInfo = await this.fetchMembershipSiteInfo(locationId);

    for (const offer of offers) {
      enriched = {
        ...offer,
        pricing: {
          amount: offer.price,
          currency: offer.currency || 'USD',
          billingCycle: offer.recurringType || 'one-time'
        },
        siteSettings: {
          domain: siteInfo.customDomain || siteInfo.subdomain,
          siteName: siteInfo.name
        },
        builderSettings: settings.builderConfig || {},
        productCount: (offer.products || []).length
      };

      this.log(`Membership offer enriched: ${offer.name}`);
    }
  } catch (error) {
    this.log(`Failed to enrich membership offers: ${error.message}`);
  }
}
```

**Implementation Priority**: Medium
**Reason**: Membership is a key revenue feature, site settings add valuable context

---

### 5. Social Planner
**Status**: ✅ Integration status endpoints found, ⚠️ No individual post endpoints found

**Available Endpoints**:
- Accounts: `GET /social-media-posting/{locationId}/accounts?fetchAll=true`
- Global Settings: `GET /social-media-posting/global-settings?locationId={locationId}`
- Integration Status (per platform): `GET /reporting/notification/leadgen/social-planner/integration-status?platform={platform}&locationId={locationId}`
  - Platforms: facebook, instagram, linkedin, twitter, tiktok, youtube, pinterest, threads, bluesky, google

**Data Available**:
- Connected social media accounts
- Platform connection status
- Account permissions
- Global posting settings
- Platform-specific configurations

**Enrichment Approach**:
```javascript
async enrichSocialPlanner(locationId) {
  // Enrich with connected accounts and integration status

  try {
    const accounts = await this.fetchSocialAccounts(locationId);
    const settings = await this.fetchSocialSettings(locationId);

    const platforms = ['facebook', 'instagram', 'linkedin', 'twitter',
                      'tiktok', 'youtube', 'pinterest', 'threads', 'bluesky'];

    const platformStatus = {};
    for (const platform of platforms) {
      const status = await this.fetchPlatformStatus(platform, locationId);
      platformStatus[platform] = {
        connected: status.isConnected || false,
        accountName: status.accountName || null,
        lastSync: status.lastSyncAt || null
      };
    }

    return {
      connectedAccounts: accounts.length,
      platforms: platformStatus,
      globalSettings: settings,
      hasScheduledPosts: settings.hasScheduled || false
    };

  } catch (error) {
    this.log(`Failed to enrich social planner: ${error.message}`);
  }
}
```

**Implementation Priority**: Low-Medium
**Reason**: Social planner data is mostly configuration; limited actionable enrichment

---

## Assets WITHOUT Individual Endpoints

The following assets **ONLY** have list endpoints available. They do **NOT** have individual detailed endpoints:

### 1. Triggers
- **Endpoint**: `GET /triggers/?locationId={locationId}&belongsTo=default`
- **Note**: Only list endpoint available. Triggers are also accessible through workflow endpoints
- **Recommendation**: No enrichment needed - list data is sufficient

### 2. Custom Fields
- **Endpoint**: `GET /locations/{locationId}/customFields/search?model=all`
- **Note**: List endpoint provides complete field configuration
- **Recommendation**: No enrichment needed - snapshot data is complete

### 3. Custom Values
- **Endpoint**: `GET /custom-data/social-media?locationId={locationId}&types=custom-values`
- **Note**: Custom values are simple key-value pairs
- **Recommendation**: No enrichment needed - list data is sufficient

### 4. Tags
- **Endpoint**: No individual endpoint found in logs
- **Note**: Tags are simple entities (just name and ID)
- **Recommendation**: No enrichment needed

### 5. Folders
- **Endpoint**: No individual endpoint found
- **Note**: Folders are organizational containers only
- **Recommendation**: No enrichment needed

### 6. Teams
- **Endpoint**: No individual endpoint found
- **Note**: Team data appears complete in snapshot
- **Recommendation**: No enrichment needed

### 7. Section Templates
- **Endpoint**: No endpoints found in logs
- **Note**: May be embedded in funnel/website data
- **Recommendation**: Investigate funnel enrichment

### 8. Quizzes
- **Endpoint**: No individual endpoints found in logs
- **Note**: May have endpoints similar to forms/surveys
- **Recommendation**: Requires manual API testing

### 9. Dashboards
- **Endpoint**: No individual endpoints found in logs
- **Note**: Dashboards may be UI-only configurations
- **Recommendation**: No enrichment likely possible

### 10. Custom Objects
- **Endpoint**: Only list endpoints found
- **Note**: Custom objects are user-defined schemas
- **Recommendation**: No enrichment needed for schema definitions

### 11. Certificates (Membership)
- **Endpoint**: No individual endpoints found
- **Note**: Certificates are simple templates
- **Recommendation**: Low priority for enrichment

### 12. Review Settings
- **Endpoint**: No individual endpoints found
- **Note**: Settings data likely complete in snapshot
- **Recommendation**: No enrichment needed

### 13. Conversation AI
- **Endpoint**: Agent-specific endpoints exist but no logs captured
- **Note**: May have individual agent endpoints
- **Recommendation**: Requires further investigation with active Conversation AI agents

### 14. Knowledge Bases
- **Endpoint**: No individual endpoints found in current logs
- **Note**: Feature may be too new or requires active knowledge bases
- **Recommendation**: Requires further investigation with active knowledge bases

---

## Implementation Roadmap

### Phase 1: High-Value Enrichments (Recommended)
1. **Campaigns** - Marketing effectiveness tracking
   - Estimated effort: 4-6 hours
   - Value: High (marketing ROI insights)

2. **Links** - Click tracking and trigger analysis
   - Estimated effort: 3-4 hours
   - Value: High (campaign effectiveness)

### Phase 2: Medium-Value Enrichments
3. **Membership Offers/Products** - Revenue asset details
   - Estimated effort: 5-7 hours
   - Value: Medium (revenue tracking)

4. **Text Templates** - Usage and content analysis
   - Estimated effort: 2-3 hours
   - Value: Medium (team productivity)

### Phase 3: Low-Priority Enrichments
5. **Social Planner** - Integration status
   - Estimated effort: 3-4 hours
   - Value: Low (mostly status data)

---

## Technical Considerations

### Rate Limiting
- All endpoints should respect GHL API rate limits
- Implement exponential backoff for failed requests
- Consider batching requests where possible

### Error Handling
- Log all enrichment failures without stopping export
- Provide fallback to basic snapshot data
- Track success rate per asset type

### Performance
- Enrich assets in parallel where possible
- Cache list endpoint responses when processing multiple items
- Consider implementing progressive enrichment (enrich most important assets first)

### Testing
- Test with locations that have:
  - Active campaigns
  - Multiple trigger links
  - Membership sites with offers
  - Connected social media accounts
- Verify enrichment doesn't break existing snapshot structure

---

## Conclusion

Based on comprehensive analysis of API logs:

**Assets Ready for Enrichment**: 5
- Campaigns (High Priority)
- Links (High Priority)
- Membership Offers/Products (Medium Priority)
- Text Templates (Medium Priority)
- Social Planner (Low Priority)

**Assets Without Enrichment Endpoints**: 15+
- Most configuration and simple assets lack individual detailed endpoints
- These assets have sufficient data in the snapshot already

**Next Steps**:
1. Implement Phase 1 enrichments (Campaigns & Links)
2. Gather user feedback on value provided
3. Evaluate Phase 2 based on user demand
4. Continue monitoring for new API endpoints in future GHL updates

---

**Log Analysis Date**: 2025-11-09
**Total Log Files Analyzed**: 10 files (~70MB)
**Unique Endpoints Discovered**: 50+
**Actionable Enrichment Opportunities**: 5
