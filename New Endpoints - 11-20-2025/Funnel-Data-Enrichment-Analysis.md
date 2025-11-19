# Funnel Data Enrichment Analysis

## Overview
This document analyzes the funnel enrichment process using `funnelId` and `locationId` to retrieve comprehensive funnel data from GoHighLevel's backend API.

## Required Parameters
- **funnelId**: Unique identifier for the funnel (e.g., `YM3NCfMvISP0drwb5ntu`)
- **locationId**: Unique identifier for the location (e.g., `l2Y3WbrBsxoFLwZdBYfj`)

## Enrichment Process

The funnel enrichment process involves three main API endpoints that progressively provide more detailed information:

### 1. Get Funnel Details (Page List)
**Endpoint**: `GET https://backend.leadconnectorhq.com/funnels/page/list`

**Query Parameters**:
- `funnelId`: The funnel identifier
- `locationId`: The location identifier

**Purpose**: Retrieves all pages within a funnel with their metadata and version history.

---

### 2. Get Funnel Step Details (Lookup List)
**Endpoint**: `GET https://backend.leadconnectorhq.com/funnels/lookup/list`

**Query Parameters**:
- `funnelId`: The funnel identifier
- `locationId`: The location identifier
- `typeId`: The step type identifier (obtained from page data)

**Purpose**: Retrieves step-level information including domain, path, and routing details.

---

### 3. Get Funnel Page Builder Details
**Endpoint**: `GET https://backend.leadconnectorhq.com/funnels/builder/page/data`

**Query Parameters**:
- `pageId`: The page identifier (obtained from page list)

**Purpose**: Retrieves detailed page builder data including all sections, rows, columns, and elements.

---

## Data Available Through Enrichment

### From Endpoint 1: Funnel Page List

#### Page-Level Data
- **\_id**: Unique page identifier
- **name**: Page name/title
- **url**: Page URL path
- **funnelId**: Parent funnel ID
- **locationId**: Location ID
- **stepId**: Associated step ID
- **deleted**: Deletion status
- **dateAdded**: Creation timestamp
- **dateUpdated**: Last update timestamp
- **updatedAt**: Last modification timestamp
- **version**: Page version number
- **pageVersion**: Page data version
- **sectionVersion**: Section structure version
- **templateType**: Template category (e.g., "optin_funnel_page")

#### Preview & Data URLs
- **previewSnapshot**: URL to page preview image
- **pageDataDownloadUrl**: Firebase storage URL for page data
- **pageDataUrl**: Relative path to page data

#### SEO Metadata (meta object)
- **title**: Page title
- **description**: Meta description
- **author**: Page author
- **keywords**: SEO keywords
- **language**: Page language (e.g., "en")
- **imageUrl**: Social sharing image URL
- **canonicalMeta**: Canonical URL metadata (array)
- **customMeta**: Custom meta tags (array)

#### Popups & Colors
- **popups**: Array of popup configurations
- **colors**: Array of color definitions

#### Version History
Each version entry contains:
- **versionId**: Unique version identifier
- **pageType**: "live" or "draft"
- **updatedAt**: Version timestamp
- **updatedBy**: User ID who made the update
- **pageDownloadPath**: Storage path for this version
- **pageDownloadUrl**: Download URL for this version

##### Integrations Per Version
Counts of elements used in each version:
- **button**: Number of button elements
- **calendar**: Number of calendar integrations
- **divider**: Number of divider elements
- **faq**: Number of FAQ elements
- **heading**: Number of heading elements
- **subHeading**: Number of subheading elements
- **image**: Number of image elements
- **paragraph**: Number of paragraph elements
- **customCode**: Number of custom code blocks
- **popup**: Boolean indicating popup usage
- **videoBackground**: Boolean indicating video background usage
- **blogMeta**:
  - **categoryNavigationList**: Blog category navigation
  - **selectedBlogCategories**: Selected blog categories

##### Meta Per Version
Same structure as page-level meta (title, description, author, etc.)

---

### From Endpoint 2: Funnel Step Details

#### Step-Level Data
- **\_id**: Unique step identifier
- **funnelId**: Parent funnel ID
- **locationId**: Location ID
- **typeId**: Step type identifier
- **type**: Step type (e.g., "step")
- **domain**: Domain where step is hosted
- **path**: URL path for the step
- **pathLowercase**: Normalized lowercase path
- **steps**: Array of sub-steps (if any)
- **deleted**: Deletion status
- **dateAdded**: Creation timestamp
- **dateUpdated**: Last update timestamp
- **updatedAt**: Last modification timestamp

#### Response Metadata
- **traceId**: Request trace identifier for debugging

---

### From Endpoint 3: Funnel Page Builder Details

#### Top-Level Page Builder Data
- **funnelId**: Parent funnel ID
- **stepId**: Associated step ID
- **locationId**: Location ID
- **pageId**: Unique page identifier
- **sections**: Array of section objects

#### Section Structure
Each section contains:
- **id**: Section identifier (e.g., "section-WbFhUgFS_D")
- **metaData**: Section metadata object

##### Section MetaData
- **id**: Section ID
- **type**: "section"
- **child**: Array of child row IDs
- **title**: Section title
- **tagName**: HTML tag name
- **class**: Class definitions for width, borders, borderRadius, radiusEdge
- **styles**: Detailed styling object including:
  - Padding (top, bottom, left, right)
  - Margin (top, bottom, left, right)
  - Background color
  - Border color/width/style
  - Box shadow
  - Z-index
  - Opacity

#### Row Structure
Each row within a section contains:
- **id**: Row identifier
- **type**: "row"
- **title**: Row title (e.g., "1 Column Row")
- **child**: Array of column IDs
- **class**: Layout classes (grid columns, vertical/horizontal alignment)
- **styles**: Styling properties
- **mobileStyles**: Mobile-specific styling
- **wrapper**: Wrapper styling (margins, padding)
- **mobileWrapper**: Mobile wrapper styling

#### Column Structure
Each column within a row contains:
- **id**: Column identifier
- **type**: "column"
- **title**: Column title (e.g., "1st Column")
- **child**: Array of element IDs
- **class**: Column-specific classes
- **styles**: Column styling
- **mobileStyles**: Mobile column styling
- **wrapper**: Column wrapper styling
- **mobileWrapper**: Mobile wrapper styling

#### Element Structure
Each element contains:

##### Common Element Properties
- **id**: Element identifier
- **type**: "element"
- **meta**: Element type (e.g., "paragraph", "button", "image", "divider")
- **title**: Element title
- **tagName**: Component tag name
- **tag**: HTML tag
- **child**: Child elements (usually empty for leaf elements)
- **class**: Element-specific classes
- **styles**: Detailed styling object
- **mobileStyles**: Mobile styling
- **wrapper**: Wrapper styling
- **mobileWrapper**: Mobile wrapper styling
- **customCss**: Array of custom CSS rules
- **extra**: Element-specific configuration

##### Element-Specific Extra Data

###### Paragraph Elements
- **nodeId**: Node identifier
- **visibility**: Desktop/mobile visibility settings
- **text**: Paragraph HTML content
- **customClass**: Array of custom CSS classes

###### Button Elements
- **nodeId**: Node identifier
- **visibility**: Desktop/mobile visibility settings
- **text**: Button text
- **subText**: Button subtitle
- **mobileFontSize**: Mobile font size
- **desktopFontSize**: Desktop font size
- **subTextDesktopFontSize**: Subtitle desktop font size
- **subTextMobileFontSize**: Subtitle mobile font size
- **typography**: Font family variable
- **iconStart**: Starting icon configuration (name, unicode, fontFamily)
- **iconEnd**: Ending icon configuration
- **action**: Button action type (e.g., "download-file", "go-to-next-funnel-step")
- **visitWebsite**: Website URL and new tab setting
- **hideElements**: Elements to hide on click
- **showElements**: Elements to show on click
- **scrollToElement**: Element ID to scroll to
- **phoneNumber**: Phone number for call actions
- **emailAddress**: Email for email actions
- **productId**: Product ID for product actions
- **stepPath**: Path to funnel step
- **saleAction**: Action after sale
- **customClass**: Custom CSS classes
- **downloadFile**: File download configuration (fileName, fileUrl)

###### Image Elements
- **nodeId**: Node identifier
- **visibility**: Desktop/mobile visibility settings
- **imageUrl**: Image source URL
- **altText**: Alt text for accessibility
- **linkUrl**: Link URL when image is clicked
- **openInNewTab**: Boolean for new tab behavior
- **customClass**: Custom CSS classes

###### Divider Elements
- **nodeId**: Node identifier
- **visibility**: Desktop/mobile visibility settings
- **customClass**: Custom CSS classes

###### Heading/SubHeading Elements
- **nodeId**: Node identifier
- **visibility**: Desktop/mobile visibility settings
- **text**: Heading text
- **customClass**: Custom CSS classes

###### Calendar Elements
- **nodeId**: Node identifier
- **visibility**: Desktop/mobile visibility settings
- **calendarId**: Integrated calendar ID
- **customClass**: Custom CSS classes

###### FAQ Elements
- **nodeId**: Node identifier
- **visibility**: Desktop/mobile visibility settings
- **questions**: Array of FAQ items (question, answer pairs)
- **customClass**: Custom CSS classes

###### Custom Code Elements
- **nodeId**: Node identifier
- **visibility**: Desktop/mobile visibility settings
- **code**: Custom HTML/CSS/JS code
- **customClass**: Custom CSS classes

##### Detailed Styling Properties
Elements contain comprehensive styling including:
- **Typography**: Font size, family, weight, style, line height, letter spacing, text align, text transform
- **Colors**: Color, background color, border color, text shadow
- **Spacing**: Padding (top, bottom, left, right), Margin (top, bottom, left, right)
- **Borders**: Border width, style, color, radius
- **Effects**: Opacity, box shadow, text shadow
- **Layout**: Width, height, max-width, max-height, display, position
- **Hover States**: Hover background color, hover text color, hover border color
- **Animations**: Entrance animations, hover animations

---

## Complete Enrichment Flow

### Step 1: Initialize with funnelId and locationId
```
Input: funnelId, locationId
```

### Step 2: Get All Pages
```
Call: GET /funnels/page/list?funnelId={funnelId}&locationId={locationId}
Output: Array of page objects with metadata and version history
Extract: pageIds, stepIds
```

### Step 3: Get Step Details (for each stepId)
```
Call: GET /funnels/lookup/list?funnelId={funnelId}&locationId={locationId}&typeId={stepId}
Output: Step objects with domain, path, routing information
```

### Step 4: Get Page Builder Details (for each pageId)
```
Call: GET /funnels/builder/page/data?pageId={pageId}
Output: Complete page structure with sections, rows, columns, and elements
```

### Step 5: Combine All Data
The enriched funnel object now contains:
- All page metadata and SEO information
- Complete version history for each page
- Step routing and domain configuration
- Full page builder structure with all elements
- All styling and configuration for every element
- Integration usage counts
- Preview images and data URLs

---

## Use Cases for Enriched Data

### 1. Funnel Cloning
- Copy complete page structures
- Preserve all styling and configurations
- Maintain version history
- Replicate integrations

### 2. Analytics & Reporting
- Track element usage across pages
- Monitor version changes over time
- Analyze page performance by structure
- Count integration usage

### 3. Migration & Backup
- Export complete funnel data
- Backup page versions
- Move funnels between locations
- Archive funnel configurations

### 4. Template Creation
- Extract successful page structures
- Identify common element patterns
- Create reusable templates
- Standardize designs

### 5. Compliance & Auditing
- Track page changes by user
- Monitor content updates
- Verify SEO metadata
- Audit deleted pages

### 6. Optimization
- Compare live vs. draft versions
- A/B test different structures
- Identify unused elements
- Optimize load performance

---

## Data Size Considerations

Based on the sample data:
- A single page's complete data can exceed 300KB
- Version history can contain 50+ versions
- Each element includes extensive styling data
- Images and media URLs are included as references
- Total enriched funnel data can be several MB

**Recommendation**: Implement pagination and caching strategies when working with large funnels.

---

## Authentication & Authorization

All endpoints require:
- Valid authentication token
- Appropriate permissions for the location
- Access rights to the specific funnel

**Note**: The endpoints are internal GoHighLevel backend APIs and may require specific authentication mechanisms.

---

## Summary

With just `funnelId` and `locationId`, you can enrich funnel data to include:

✓ Complete page metadata and SEO information
✓ Full version history with timestamps and authors
✓ Integration usage counts for each element type
✓ Step routing and domain configuration
✓ Complete page builder structure (sections > rows > columns > elements)
✓ Detailed styling for every element (desktop and mobile)
✓ Element-specific configurations (buttons, images, forms, etc.)
✓ Preview images and data download URLs
✓ Custom code and CSS
✓ Popup configurations
✓ Color schemes
✓ Blog metadata and categories

This enrichment process provides everything needed to fully understand, replicate, migrate, or analyze any funnel within the GoHighLevel platform.
