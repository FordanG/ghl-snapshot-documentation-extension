# New Enrichment Endpoints Documentation

This document details newly discovered GoHighLevel API endpoints that can be used to retrieve additional data for snapshot enrichment. These endpoints use both `backend.leadconnectorhq.com` and `services.leadconnectorhq.com` base URLs.

## Table of Contents

1. [Pipelines](#pipelines)
2. [Calendars](#calendars)
3. [Calendar Groups](#calendar-groups)
4. [Forms](#forms)
5. [Surveys](#surveys)
6. [Email Builder](#email-builder)

---

## Pipelines

### Get All Pipelines
Retrieves all opportunity pipelines for a location including stages and configuration.

**Endpoint:** `GET https://backend.leadconnectorhq.com/opportunities/pipelines`

**Query Parameters:**
- `locationId` (required): The location ID

**Response Structure:**
```json
{
  "pipelines": [
    {
      "id": "string",
      "name": "string",
      "originId": "string",
      "dateAdded": "ISO 8601 datetime",
      "dateUpdated": "ISO 8601 datetime",
      "showInFunnel": boolean,
      "showInPieChart": boolean,
      "stages": [
        {
          "id": "string",
          "name": "string",
          "originId": "string",
          "position": number,
          "showInFunnel": boolean,
          "showInPieChart": boolean
        }
      ]
    }
  ]
}
```

**Data Retrieved:**
- Pipeline IDs and names
- Pipeline creation and update timestamps
- Stage configurations (IDs, names, positions)
- Funnel and pie chart visibility settings
- Stage ordering and hierarchy

**Use Cases:**
- Map pipeline structures for workflow recreation
- Export pipeline stages and their order
- Analyze opportunity flow configurations
- Backup pipeline settings

---

## Calendars

### Get All Calendars
Retrieves all calendar configurations for a location.

**Endpoint:** `GET https://backend.leadconnectorhq.com/calendars/`

**Query Parameters:**
- `locationId` (required): The location ID
- `showThirdParty` (optional): Whether to include third-party calendars (default: false)

**Response Structure:**
```json
{
  "calendars": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "calendarType": "round_robin|event_based|class|collective|service",
      "eventType": "string",
      "slug": "string",
      "widgetSlug": "string",
      "dateAdded": "ISO 8601 datetime",
      "dateUpdated": "ISO 8601 datetime",
      "deleted": boolean,
      "locationId": "string",
      "groupId": "string",
      "isActive": boolean,
      "version": number,
      "calendarCoverImage": "string",

      "slotDuration": number,
      "slotDurationUnit": "mins|hours",
      "slotInterval": number,
      "slotIntervalUnit": "mins|hours",
      "slotBufferUnit": "mins|hours",
      "preBufferUnit": "mins|hours",

      "appoinmentPerSlot": number,
      "appoinmentPerDay": "string",

      "openHours": [
        {
          "daysOfTheWeek": [number],
          "hours": [
            {
              "openHour": number,
              "openMinute": number,
              "closeHour": number,
              "closeMinute": number
            }
          ]
        }
      ],

      "enableOfficeHours": boolean,
      "enableRecurring": boolean,
      "enableConsentCheck": boolean,
      "enableGuests": boolean,
      "enableChargeGuests": boolean,
      "enableStaffSelection": boolean,
      "enableSameUserAssignment": boolean,
      "enableSameUserAssignmentForReschedule": boolean,

      "allowBookingAfter": number,
      "allowBookingAfterUnit": "hours|days|weeks|months",
      "allowBookingForUnit": "days|weeks|months",
      "allowCancellation": boolean,
      "allowReschedule": boolean,

      "autoConfirm": boolean,
      "stickyContact": boolean,
      "shouldAssignContactToTeamMember": boolean,
      "shouldSkipAssigningContactForExisting": boolean,

      "eventTitle": "string",
      "eventColor": "string (hex)",
      "notes": "string",
      "consentLabel": "string",

      "formId": "string",
      "formSubmitType": "ThankYouMessage|RedirectURL",
      "formSubmitThanksMessage": "string",
      "formSubmitRedirectUrl": "string",

      "teamMembers": [
        {
          "userId": "string",
          "priority": number,
          "selected": boolean,
          "isZoomAdded": "string",
          "zoomOauthId": "string",
          "meetingLocation": "string",
          "locationConfigurations": [
            {
              "location": "string",
              "position": number,
              "kind": "custom|inbound_call|zoom|google_meet",
              "zoomOauthId": "string",
              "meetingId": "string"
            }
          ]
        }
      ],

      "locationConfigurations": [],

      "widgetConfig": {
        "primarySettings": {
          "primaryColor": "string (hex)",
          "backgroundColor": "string (hex)",
          "buttonText": "string",
          "showCalendarTitle": boolean,
          "showCalendarDescription": boolean,
          "showCalendarDetails": boolean
        },
        "default": boolean,
        "pageOrder": [
          {
            "kind": "form|calendar",
            "position": number
          }
        ]
      },

      "widgetLogo": {
        "shape": "square|circle",
        "url": "string"
      },

      "widgetType": "default|custom",

      "recurring": {
        "count": number,
        "bookingOption": "skip|create",
        "bookingOverlapDefaultStatus": "string",
        "interval": number,
        "freq": "DAILY|WEEKLY|MONTHLY",
        "monthDays": [],
        "weekDays": []
      },

      "cancellationPreference": {
        "expiryTimeUnit": "mins|hours|days",
        "expiryTime": number
      },

      "reschedulePreference": {
        "expiryTimeUnit": "mins|hours|days",
        "expiryTime": number
      },

      "lookBusyConfig": {
        "enabled": boolean,
        "lookBusyPercentage": number
      },

      "linkedCalendars": {
        "google": {},
        "clio": {},
        "drchrono": {},
        "calendly": {}
      },

      "createdBy": {
        "userId": "string",
        "channel": "APP|API",
        "source": "WEB_USER|INTEGRATION",
        "timestamp": "ISO 8601 datetime",
        "traceId": "string"
      },

      "lastUpdatedBy": {
        "userId": "string",
        "channel": "APP|API",
        "source": "WEB_USER|INTEGRATION",
        "timestamp": "ISO 8601 datetime",
        "traceId": "string"
      },

      "pixelId": "string",
      "fbPixelId": "string",
      "googleInvitationEmails": boolean,
      "guestType": "collect_detail|count_only",
      "isLivePaymentMode": boolean,
      "stripe": {},
      "codeBlock": "string",
      "providerId": "string"
    }
  ]
}
```

**Data Retrieved:**
- Calendar IDs, names, descriptions
- Calendar types and event types
- Booking rules and restrictions
- Availability windows (open hours)
- Slot configurations (duration, intervals, buffers)
- Team member assignments and priorities
- Meeting location configurations
- Widget customization settings
- Form integration settings
- Recurring appointment settings
- Cancellation and reschedule policies
- Third-party calendar integrations
- Payment settings
- Custom code blocks
- Audit trail (created by, updated by)

**Use Cases:**
- Export complete calendar configurations
- Backup appointment booking settings
- Analyze team member availability distribution
- Map calendar-to-form relationships
- Document booking policies
- Archive widget customizations

---

## Calendar Groups

### Get All Calendar Groups
Retrieves calendar group configurations.

**Endpoint:** `GET https://backend.leadconnectorhq.com/calendars/groups`

**Query Parameters:**
- `locationId` (required): The location ID

**Response Structure:**
```json
{
  "groups": [
    {
      "id": "string",
      "locationId": "string",
      "name": "string",
      "description": "string",
      "slug": "string",
      "isActive": boolean,
      "dateAdded": "ISO 8601 datetime",
      "dateUpdated": "ISO 8601 datetime"
    }
  ]
}
```

**Data Retrieved:**
- Group IDs and names
- Group descriptions
- Group slugs for URL access
- Active/inactive status
- Creation and update timestamps

**Use Cases:**
- Map calendar organizational structure
- Export group hierarchies
- Document calendar categorization

---

## Forms

### Get All Forms (List)
Retrieves a paginated list of forms with metadata and version history.

**Endpoint:** `GET https://services.leadconnectorhq.com/forms/`

**Query Parameters:**
- `locationId` (required): The location ID
- `skip` (optional): Number of records to skip (default: 0)
- `limit` (optional): Number of records to return (default: 20)
- `query` (optional): Search query string
- `type` (optional): Filter by type ("form")
- `productType` (optional): Filter by product type ("form")

**Response Structure:**
```json
{
  "forms": [
    {
      "_id": "string",
      "locationId": "string",
      "name": "string",
      "lowerName": "string",
      "productType": "form",
      "deleted": boolean,
      "version": number,
      "dateAdded": "ISO 8601 datetime",
      "dateUpdated": "ISO 8601 datetime",
      "updatedAt": "ISO 8601 datetime",
      "updatedBy": "string (user name)",
      "versionHistory": [
        {
          "versionId": "string (UUID)",
          "formDataUrl": "string (path)",
          "formDataDownloadUrl": "string (full URL)",
          "updatedAt": "ISO 8601 datetime",
          "updatedBy": "string (user ID)",
          "updatedByUser": "string (user name)"
        }
      ]
    }
  ],
  "total": number,
  "traceId": "string (UUID)"
}
```

**Data Retrieved:**
- Form IDs and names
- Form versions and version history
- Update timestamps and user information
- Form data download URLs for each version
- Total count of forms

**Use Cases:**
- List all forms in a location
- Track form version history
- Download form data snapshots
- Identify form authors and update history
- Audit form changes over time

---

### Get Form Details by ID
Retrieves complete form configuration including all fields, styling, and settings.

**Endpoint:** `GET https://services.leadconnectorhq.com/forms/{formId}`

**Path Parameters:**
- `formId` (required): The form ID

**Response Structure:**
```json
{
  "form": {
    "_id": "string",
    "locationId": "string",
    "dateAdded": "ISO 8601 datetime",
    "dateUpdated": "ISO 8601 datetime",
    "deleted": boolean,
    "productType": "form",
    "formData": {
      "autoResponder": boolean,
      "emailNotifications": boolean,
      "enablePartialContactCreation": boolean,

      "fieldCSS": "string (CSS code)",
      "mobileFieldCSS": "string (CSS code)",

      "form": {
        "company": {
          "name": "string",
          "logoURL": "string"
        },
        "address": {
          "autoCompleteEnabled": boolean,
          "children": [],
          "label": "string",
          "placeholder": "string",
          "required": boolean
        },
        "customStyle": "string (CSS)",
        "currentThemeId": "string",
        "fbPixelId": "string",
        "pixelId": "string",

        "style": {
          "background": "string (hex)",
          "bgImage": "string (URL)",
          "mobileBgImage": "string (URL)",
          "acBranding": boolean,
          "fieldSpacing": number,
          "border": {
            "border": number,
            "color": "string (hex)",
            "radius": number,
            "style": "none|solid|dashed|dotted"
          },
          "padding": {
            "top": number,
            "right": number,
            "bottom": number,
            "left": number
          },
          "shadow": {
            "horizontal": number,
            "vertical": number,
            "blur": number,
            "spread": number,
            "color": "string (hex)"
          }
        },

        "fieldStyle": {
          "bgColor": "string (hex)",
          "fontColor": "string (hex)",
          "placeholderColor": "string (hex)",
          "placeholderFontFamily": "string",
          "placeholderFontSize": number,
          "placeholderFontWeight": number,
          "labelColor": "string (hex)",
          "labelFontFamily": "string",
          "labelFontSize": number,
          "labelFontWeight": number,
          "labelAlignment": "top|left|right",
          "labelWidth": number,
          "activeTagBgColor": "string (hex)",
          "border": {
            "type": "none|solid|dashed|dotted",
            "color": "string (hex)",
            "border": number,
            "radius": number
          },
          "padding": {
            "top": number,
            "right": number,
            "bottom": number,
            "left": number
          },
          "shadow": {
            "horizontal": number,
            "vertical": number,
            "blur": number,
            "spread": number,
            "color": "string (hex)"
          },
          "shortLabel": {
            "color": "string (hex)",
            "fontFamily": "string",
            "fontSize": number,
            "fontWeight": number
          }
        },

        "submitButtonStyle": {
          "bgColor": "string (hex)",
          "fontColor": "string (hex)",
          "fontFamily": "string",
          "fontSize": number,
          "fontWeight": number,
          "text": "string",
          "border": {},
          "padding": {},
          "shadow": {}
        },

        "formAction": {
          "actionType": "1|2",
          "thankyouText": "string",
          "redirectUrl": "string",
          "headerImageSrc": "string (URL)",
          "mobileHeaderImageSrc": "string (URL)",
          "headerFullWidthEnable": boolean,
          "footerHtml": "string (HTML)"
        },

        "fields": [
          {
            "id": "string",
            "type": "text|email|phone|textarea|checkbox|radio|select|...",
            "label": "string",
            "placeholder": "string",
            "required": boolean,
            "fieldKey": "string",
            "position": number,
            "options": [],
            "validation": {},
            "conditional": {}
          }
        ],

        "width": number,
        "formLabelVisible": boolean,
        "inputStyleType": "box|underline",
        "stickyContact": boolean,
        "isGDPRCompliant": boolean,
        "enableTimezone": boolean,
        "formSubmissionEvent": "None|PageView|...",
        "pageViewEvent": "None|..."
      },

      "formDataDownloadUrl": "string (URL)",
      "parentFolderId": "string",
      "parentFolderName": "string"
    }
  }
}
```

**Data Retrieved:**
- Complete form configuration
- All form fields and their properties
- Custom CSS styling (desktop and mobile)
- Company branding (logo, name)
- Form layout settings
- Field styling (colors, fonts, borders, shadows, padding)
- Submit button configuration
- Thank you page/redirect settings
- Form submission tracking pixels
- GDPR compliance settings
- Conditional logic rules
- Field validation rules
- Auto-responder configuration
- Email notification settings
- Version information

**Use Cases:**
- Export complete form structure
- Backup form designs and styling
- Clone forms to other locations
- Analyze form field configurations
- Document data collection points
- Archive form versions
- Extract custom CSS for reuse
- Map form-to-field relationships

---

## Surveys

### Get All Surveys (List)
Retrieves a paginated list of surveys with metadata and version history.

**Endpoint:** `GET https://services.leadconnectorhq.com/surveys/`

**Query Parameters:**
- `locationId` (required): The location ID
- `skip` (optional): Number of records to skip (default: 0)
- `limit` (optional): Number of records to return (default: 20)
- `query` (optional): Search query string
- `type` (optional): Filter by type ("survey" or "folder")

**Response Structure:**
```json
{
  "surveys": [
    {
      "_id": "string",
      "locationId": "string",
      "name": "string",
      "lowerName": "string",
      "type": "survey|folder",
      "deleted": boolean,
      "version": number,
      "dateAdded": "ISO 8601 datetime",
      "dateUpdated": "ISO 8601 datetime",
      "updatedAt": "ISO 8601 datetime",
      "updatedBy": "string (user name)",
      "versionHistory": [
        {
          "versionId": "string (UUID)",
          "surveyDataUrl": "string (path)",
          "surveyDataDownloadUrl": "string (full URL)",
          "updatedAt": "ISO 8601 datetime",
          "updatedBy": "string (user ID)",
          "updatedByUser": "string (user name)"
        }
      ]
    }
  ],
  "total": number,
  "traceId": "string (UUID)"
}
```

**Data Retrieved:**
- Survey IDs and names
- Survey versions and version history
- Update timestamps and user information
- Survey data download URLs for each version
- Total count of surveys
- Folder organization

**Use Cases:**
- List all surveys in a location
- Track survey version history
- Download survey data snapshots
- Identify survey authors and update history
- Audit survey changes over time
- Map survey folder structure

---

### Get Survey Folders
Retrieves survey folder structure for organization.

**Endpoint:** `GET https://services.leadconnectorhq.com/surveys/`

**Query Parameters:**
- `locationId` (required): The location ID
- `skip` (optional): Number of records to skip
- `limit` (optional): Number of records to return
- `query` (optional): Search query string
- `type`: "folder" (required for folder listing)

**Response Structure:**
Same as survey list, but filtered to show only folder items.

**Data Retrieved:**
- Folder IDs and names
- Folder hierarchy
- Creation and update information
- Version history for folders

**Use Cases:**
- Map survey organizational structure
- Export folder hierarchies
- Document survey categorization

---

### Get Survey Details by ID
Retrieves complete survey configuration including all slides, fields, logic, and styling.

**Endpoint:** `GET https://services.leadconnectorhq.com/surveys/{surveyId}`

**Path Parameters:**
- `surveyId` (required): The survey ID

**Response Structure:**
```json
{
  "survey": {
    "_id": "string",
    "locationId": "string",
    "dateAdded": "ISO 8601 datetime",
    "dateUpdated": "ISO 8601 datetime",
    "deleted": boolean,
    "formData": {
      "autoResponder": boolean,
      "emailNotifications": boolean,
      "enablePartialContactCreation": boolean,
      "newFooter": boolean,

      "fieldCSS": "string (CSS code)",
      "mobileFieldCSS": "string (CSS code)",

      "form": {
        "company": {
          "name": "string"
        },
        "address": {
          "autoCompleteEnabled": boolean,
          "children": [],
          "label": "string",
          "placeholder": "string",
          "required": boolean
        },
        "currentThemeId": "string",
        "customStyle": "string (CSS)",
        "fbPixelId": "string",

        "disableAutoNavigation": boolean,
        "enableTimezone": boolean,
        "formLabelVisible": boolean,
        "formSubmissionEvent": "None|...",
        "pageViewEvent": "None|...",
        "inputStyleType": "box|underline",
        "isAnimationDisabled": boolean,
        "isBackButtonEnable": boolean,
        "isGDPRCompliant": boolean,
        "isProgressBarEnabled": boolean,
        "isSurveyScrollEnabled": boolean,
        "stickyContact": boolean,
        "width": number,

        "style": {
          "background": "string (hex)",
          "bgImage": "string (URL)",
          "mobileBgImage": "string (URL)",
          "acBranding": boolean,
          "fieldSpacing": number,
          "border": {
            "border": number,
            "color": "string (hex)",
            "radius": number,
            "style": "none|solid|dashed|dotted"
          },
          "padding": {
            "top": number,
            "right": number,
            "bottom": number,
            "left": number
          },
          "shadow": {
            "horizontal": number,
            "vertical": number,
            "blur": number,
            "spread": number,
            "color": "string (hex)"
          }
        },

        "fieldStyle": {
          "bgColor": "string (hex)",
          "fontColor": "string (hex)",
          "placeholderColor": "string (hex)",
          "placeholderFontFamily": "string",
          "placeholderFontSize": number,
          "placeholderFontWeight": number,
          "labelColor": "string (hex)",
          "labelFontFamily": "string",
          "labelFontSize": number,
          "labelFontWeight": number,
          "labelAlignment": "top|left|right",
          "labelWidth": number,
          "activeTagBgColor": "string (hex)",
          "border": {},
          "padding": {},
          "shadow": {},
          "shortLabel": {
            "color": "string (hex)",
            "fontFamily": "string",
            "fontSize": number,
            "fontWeight": number
          }
        },

        "footerStyle": {
          "backgroundFill": "string (hex)",
          "fontFamily": "string",
          "fontSize": number,
          "fontWeight": number,
          "height": number,
          "theme": "steps|...",
          "stickyFooter": boolean,
          "enableProgressBar": boolean,
          "buttonStyle": {
            "buttonType": "textAndArrow|textOnly|arrowOnly",
            "position": "leftAndRight|center",
            "fontColor": "string (hex)",
            "nextBtnText": "string",
            "prevBtnText": "string",
            "submitBtnText": "string",
            "nextButtonBgColor": "string (hex)",
            "backButtonBgColor": "string (hex)",
            "submitButtonBgColor": "string (hex)"
          },
          "progressBarStyle": {
            "borderColor": "string (hex)",
            "borderRadius": number,
            "borderWidth": number,
            "completeFillColor": "string (hex)",
            "inactiveFillColor": "string (hex)",
            "textColor": "string (hex)"
          },
          "computedStyles": {
            "showArrow": boolean,
            "showText": boolean,
            "styles": {}
          }
        },

        "submitMessageStyle": {
          "bgColor": "string (hex)",
          "color": "string (hex)",
          "fontFamily": "string",
          "fontSize": number,
          "fontWeight": number
        },

        "formAction": {
          "actionType": "1|2",
          "fieldPerPage": number,
          "fieldSettingEnable": boolean,
          "endsurveyType": "1|2",
          "endsurveyText": "string",
          "endsurveyUrl": "string",
          "disqualifiedType": "1|2",
          "disqualifiedText": "string",
          "disqualifiedUrl": "string",
          "thankyouText": "string",
          "redirectUrl": "string",
          "headerImageSrc": "string (URL)",
          "mobileHeaderImageSrc": "string (URL)",
          "headerFullWidthEnable": boolean,
          "footerHtml": "string (HTML)"
        },

        "autoResponderConfig": null,
        "emailNotificationsConfig": null,
        "opportunitySettings": null,
        "payment": null
      },

      "slides": [
        {
          "id": "string (timestamp-number)",
          "slideName": "string",
          "button": {
            "background": "string (hex)",
            "color": "string (hex)",
            "border": {
              "border": number,
              "radius": number,
              "padding": {}
            }
          },
          "logic": {
            "fieldId": {
              "option_0": {
                "fieldId": "string",
                "id": "string (slide ID to navigate to)",
                "index": number,
                "name": "string (slide name)",
                "optionIndex": number,
                "optionName": "string",
                "status": boolean
              }
            }
          },
          "slideData": [
            {
              "Id": "string",
              "id": "string",
              "tag": "string",
              "type": "text|email|phone|radio|checkbox|single_options|...",
              "name": "string",
              "label": "string",
              "placeholder": "string",
              "required": boolean,
              "active": boolean,
              "edit": boolean,
              "deleted": boolean,
              "standard": boolean,
              "showInForms": boolean,
              "customEdited": boolean,
              "customfieldUpdated": boolean,
              "allowCustomOption": boolean,
              "isAllowedCustomOption": boolean,

              "dataType": "TEXT|RADIO|SINGLE_OPTIONS|LARGE_TEXT|...",
              "documentType": "field",
              "model": "contact|opportunity",
              "fieldKey": "contact.field_name",
              "hiddenFieldQueryKey": "string",
              "parentId": "string",
              "locationId": "string",
              "position": number,
              "fieldsCount": number,

              "customFieldLabel": "string",
              "description": "string",
              "preview": "string (HTML)",

              "picklistOptions": ["string"],
              "picklistOptionsImage": [],

              "dateAdded": "ISO 8601 datetime",
              "originId": "string"
            }
          ]
        }
      ],

      "parentFolderId": "string",
      "parentFolderName": "string"
    }
  }
}
```

**Data Retrieved:**
- Complete survey configuration
- All slides and their order
- All form fields per slide
- Conditional logic and branching rules
- Custom CSS styling (desktop and mobile)
- Company branding
- Survey layout settings
- Field styling (colors, fonts, borders, shadows, padding)
- Footer configuration (buttons, progress bar)
- Navigation settings (back button, auto-navigation)
- Thank you page/redirect settings
- Disqualification logic and messages
- Form submission tracking pixels
- GDPR compliance settings
- Field validation rules
- Custom field mappings to contact/opportunity fields
- Version information

**Use Cases:**
- Export complete survey structure
- Backup survey designs and styling
- Clone surveys to other locations
- Analyze survey logic and flow
- Document data collection workflows
- Archive survey versions
- Extract custom CSS for reuse
- Map survey-to-CRM field relationships
- Analyze conditional branching logic
- Document multi-step form flows

---

## Email Builder

### Get Email Builder Templates
Retrieves email template data from the email builder.

**Endpoint:** `GET https://backend.leadconnectorhq.com/emails/builder`

**Query Parameters:**
- `locationId` (required): The location ID

**Note:** This endpoint was discovered but detailed structure requires further analysis.

### Get Specific Email Builder Data
Retrieves specific email template configuration.

**Endpoint:** `GET https://backend.leadconnectorhq.com/emails/builder/data/{locationId}/{templateId}`

**Path Parameters:**
- `locationId` (required): The location ID
- `templateId` (required): The email template ID

**Note:** This endpoint was discovered but detailed structure requires further analysis.

---

## Implementation Notes

### Base URLs
- **Backend API:** `https://backend.leadconnectorhq.com`
- **Services API:** `https://services.leadconnectorhq.com`

Note the difference - some endpoints use `services.leadconnectorhq.com` instead of `backend.leadconnectorhq.com`.

### Authentication
All endpoints require proper authentication. Use the same authentication method as other GoHighLevel API endpoints.

### Rate Limiting
Apply appropriate rate limiting to avoid API throttling. Consider implementing:
- Request delays between calls
- Batch processing for multiple items
- Retry logic with exponential backoff

### Data Relationships
- Forms and Surveys can be linked to Calendars via `formId` field in calendar config
- Pipelines contain nested stages
- Calendars can belong to Calendar Groups via `groupId`
- Forms and Surveys can be organized in folders via `parentFolderId`
- Team members in calendars are referenced by `userId`

### Version History
Both Forms and Surveys maintain version history with downloadable snapshots. This allows:
- Point-in-time restoration
- Change tracking
- Audit trails
- Historical data analysis

### Pagination
Forms and Surveys endpoints support pagination via `skip` and `limit` parameters. Default limit is typically 20 items.

### Download URLs
Version history includes `formDataDownloadUrl` and `surveyDataDownloadUrl` fields pointing to Google Cloud Storage. These URLs contain complete form/survey data snapshots for each version.

---

## Usage Examples

### Example 1: Get All Pipelines for a Location
```javascript
const locationId = 'l2Y3WbrBsxoFLwZdBYfj';
const response = await fetch(
  `https://backend.leadconnectorhq.com/opportunities/pipelines?locationId=${locationId}`,
  {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN'
    }
  }
);
const data = await response.json();
console.log(data.pipelines);
```

### Example 2: Get All Forms with Pagination
```javascript
const locationId = 'l2Y3WbrBsxoFLwZdBYfj';
const skip = 0;
const limit = 10;

const response = await fetch(
  `https://services.leadconnectorhq.com/forms/?skip=${skip}&limit=${limit}&locationId=${locationId}&type=form`,
  {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN'
    }
  }
);
const data = await response.json();
console.log(`Total forms: ${data.total}`);
console.log(`Retrieved: ${data.forms.length}`);
```

### Example 3: Get Detailed Form Configuration
```javascript
const formId = 'ynwsWJ6cbXNUlMeYjI00';
const response = await fetch(
  `https://services.leadconnectorhq.com/forms/${formId}`,
  {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN'
    }
  }
);
const data = await response.json();
console.log(data.form.formData);
```

### Example 4: Get All Calendars Without Third-Party
```javascript
const locationId = 'l2Y3WbrBsxoFLwZdBYfj';
const response = await fetch(
  `https://backend.leadconnectorhq.com/calendars/?locationId=${locationId}&showThirdParty=false`,
  {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN'
    }
  }
);
const data = await response.json();
console.log(data.calendars);
```

### Example 5: Get Survey Details with Full Configuration
```javascript
const surveyId = 'BYpU5I7YAvQrgZTz1Ho0';
const response = await fetch(
  `https://services.leadconnectorhq.com/surveys/${surveyId}`,
  {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN'
    }
  }
);
const data = await response.json();
// Access slides, logic, styling
console.log(data.survey.formData.slides);
console.log(data.survey.formData.form.fieldStyle);
```

---

## Data Enrichment Strategy

When building a snapshot enrichment tool:

1. **Phase 1: Metadata Collection**
   - Get all pipelines and stages
   - List all calendars and groups
   - List all forms and surveys (with pagination)

2. **Phase 2: Detailed Configuration**
   - For each form ID, fetch detailed configuration
   - For each survey ID, fetch detailed configuration
   - For each calendar, extract team member assignments

3. **Phase 3: Version History**
   - Download version history for forms
   - Download version history for surveys
   - Store historical snapshots for audit

4. **Phase 4: Relationship Mapping**
   - Map calendars to their associated forms
   - Map forms/surveys to pipelines (via workflows)
   - Map team members to calendars
   - Map custom fields to CRM fields

5. **Phase 5: Asset Extraction**
   - Download custom CSS from forms/surveys
   - Extract branding assets (logos, images)
   - Archive pixel tracking IDs
   - Document integration settings

---

## Known Limitations

1. **Email Builder Endpoints:** Structure needs further analysis
2. **Authentication:** Specific auth requirements not fully documented
3. **Rate Limits:** Exact rate limiting thresholds unknown
4. **Data Completeness:** Some nested objects may have additional undocumented fields
5. **Third-Party Integrations:** Integration-specific data (Zoom, Google, etc.) may require additional scopes

---

## Security Considerations

1. **Download URLs:** Version history download URLs point to Google Cloud Storage and may have time-limited access
2. **Sensitive Data:** Forms and surveys may contain PII mapping - handle with care
3. **API Keys:** Some configurations contain API keys and integration tokens - sanitize before storage
4. **Tracking Pixels:** Facebook and custom pixels may contain account-specific IDs

---

## Change Log

- **2025-11-20:** Initial documentation created from endpoint discovery
- Document based on actual API responses from production environment
- All endpoints verified as functional with real data

---

## Contributors

This documentation was created through analysis of network traffic and API responses from the GoHighLevel platform.

## License

This documentation is provided as-is for educational and development purposes.
