# GHL Utils - Build System

This build system obfuscates and minifies your Chrome extension code to protect it from being copied.

## What It Does

1. **Obfuscates** all JavaScript files with aggressive protection:
   - Renames variables to hexadecimal values
   - Flattens control flow
   - Injects dead code
   - Encodes strings in base64
   - Transforms object keys
   - Splits strings into chunks

2. **Minifies** code to reduce size and remove any remaining readability

3. **Creates a distributable ZIP** file ready to share

## Installation

```bash
cd build-system
npm install
```

## Usage

```bash
npm run build
```

This will:

- Process all JavaScript files from the parent directory
- Create a `dist/` folder with obfuscated code
- Generate `ghl-utils-protected.zip` ready for distribution

## Output

- `dist/` - Contains the protected extension files
- `snapshot-ai.zip` - Ready-to-share zip file
- `snapshot-ai.crx` - Chrome extension package (with installation warnings)
- `extension-key.pem` - Private key for signing updates (keep this secure!)

## Important Notes

- The obfuscated code will still work exactly the same
- Original source files are NOT modified
- Keep your original source code private
- Only distribute the protected zip file
- Code will be significantly harder to reverse engineer

## Protection Level

The obfuscation settings are configured for high protection while maintaining Chrome extension compatibility:

- Control flow flattening: 75%
- Dead code injection: 40%
- String encoding: Base64
- String array threshold: 75%

This makes the code very difficult to understand, even with debugging tools.

## About CRX Files

The build process automatically generates a `.crx` file, which is a Chrome extension package. However, there are important limitations:

**Important:** Chrome no longer allows one-click installation of CRX files from outside the Chrome Web Store (since 2018). Users will:

- See security warnings when trying to install
- Need to enable "Developer Mode" in Chrome
- May see the extension disabled after installation

**Recommended Distribution Methods:**

1. **Chrome Web Store** (Best option) - True one-click installation, automatic updates
2. **ZIP file** - Users extract and load unpacked in Developer Mode
3. **CRX file** - Only useful for enterprise deployment with policy configuration

The CRX file uses a private key (`extension-key.pem`) for signing. Keep this key secure and don't commit it to version control!

---

## Recent Feature Updates

The runtime exporter (`snapshot-exporter.js`) has picked up four significant changes — make sure to rebuild with `npm run build` after pulling these in so the distributed zip includes them.

### 1. Tag contact counts from Search Contacts

The GHL `/locations/{id}/tags` endpoint does not return usage counts — it only returns tag metadata. Previously the export defaulted `contactCount` to `0` for every tag. The export now:

- Calls `POST /contacts/search` (services backend) before enriching tags, paginating with `searchAfter` cursors at `pageLimit: 500`.
- Folds every contact's `tags[]` into a `Map<lowercasedName, count>` locally — handles both `["tag-name"]` (string) and `[{name: "..."}]` (object) shapes that the API returns.
- Passes the map into `enrichTags` so `contactCount` and `totalUsage` reflect real usage.
- Retries transient failures (429, network, 5xx) with exponential backoff and warns in the console if the total scan falls short of `response.total`.
- Surfaces live progress to the popup: `Scanning contacts for tag counts (2400/18302)...`.

Gated on tags actually being in the selected export set, so a run without tags doesn't pay the scan cost.

### 2. Trigger Links reverse-lookup + processed last

Each trigger link now carries columns showing where it's referenced:

- `usedInEmailTemplates`, `usedInForms`, `usedInSurveys`, `usedInWorkflows`, `usedInFunnels`, `usedInTextTemplates`, `usedInCampaigns`
- `totalReferences`

Trigger Links are deferred until after every other asset type is enriched, so the reverse-lookup scans the fully enriched data. Matching uses the link's 24-char MongoDB ID as a substring probe against each candidate asset's serialized JSON — effectively collision-free, and catches `{{trigger_links.<id>}}` merge tags, workflow trigger-link action configs, and raw embeds.

### 3. JSON-first export ordering

Excel's per-cell limit (32,767 chars) only applies during worksheet building, but JSON is now explicitly written **before** Excel/CSV so there's no way for a truncated cell to leak into the exported JSON. Order in the location export:

1. Build enriched data (`convertLocationToExcel`)
2. Download JSON
3. Download HTML dashboard
4. Download Excel (or the CSV batch)

### 4. Self-contained HTML dashboard

Every location export now also produces `Location_{id}_Dashboard_{timestamp}.html` — a single-file dashboard that opens by double-click. Features:

- Sticky sidebar TOC with live counts
- Collapsible sections via native `<details>`
- Folder grouping for custom fields, custom values, email templates, snippets
- "Open in GHL ↗" deep links per asset (workflows, forms, funnels, calendars, pipelines, email templates, knowledge bases, trigger links)
- Tag / "used in" chips (tags show `workflowsUsingTag`; trigger links show every reverse-lookup column)
- Color swatches for tags
- Per-card "Full data" reveal with the full enrichment JSON
- Global search that filters cards by name / id / string fields and auto-expands every section while searching

Zero external deps — CSS and JS are inlined, data is embedded as a `<script>` blob, so the file opens offline.

### Export file set

A location export now produces:

| Format | Files                                  |
| ------ | -------------------------------------- |
| `xlsx` | `.xlsx` + `.json` + `.html` (3 files)  |
| `csv`  | N × `.csv` + `.json` + `.html`         |

The snapshot export path (`exportSnapshotAssets`) still emits only Excel **or** CSV — no JSON or HTML yet. Parity there is a straightforward follow-up if needed.
