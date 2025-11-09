/**
 * GHL Snapshot Export Documentation
 *
 * This module exports GHL snapshot assets to CSV format for documentation purposes.
 * It uses the revex-auth system to authenticate and fetch snapshot data from the
 * GHL backend API.
 *
 * Based on the workflow export implementation in GHL Utils
 */

console.log('[Snapshot Exporter] Module loaded');

/**
 * Main function to export snapshot assets
 * @param {string} snapshotId - The snapshot ID to export
 * @param {string} companyId - The company ID
 * @param {string} type - Type of assets to fetch (default: 'own')
 * @param {string} format - Export format: 'csv' or 'xlsx' (default: 'xlsx')
 */
async function exportSnapshotAssets(snapshotId, companyId, type = 'own', format = 'xlsx') {
    console.log('[Snapshot Exporter] Starting export for snapshot:', snapshotId);

    try {
        // Ensure revex is ready
        if (!window.ghlUtilsRevex) {
            throw new Error('Revex authentication not available. Please reload the page.');
        }

        console.log('[Snapshot Exporter] Waiting for Revex to be ready...');
        await window.ghlUtilsRevex.waitForReady();
        console.log('[Snapshot Exporter] Revex is ready');

        // Send progress update
        sendProgressUpdate(5, 'Fetching snapshot data...');

        // Fetch snapshot data with retry logic for 401 errors
        const endpoint = `/snapshots-appengine/snapshot/${snapshotId}/get_assets?type=${type}&companyId=${companyId}`;
        console.log('[Snapshot Exporter] Fetching from endpoint:', endpoint);

        let response = null;
        let attempts = 0;
        const maxAttempts = 3;

        while (!response && attempts < maxAttempts) {
            attempts++;
            try {
                console.log(`[Snapshot Exporter] Attempt ${attempts}/${maxAttempts}...`);
                response = await window.ghlUtilsRevex.get(endpoint);
                console.log('[Snapshot Exporter] Snapshot data fetched successfully');
            } catch (error) {
                console.error(`[Snapshot Exporter] Attempt ${attempts} failed:`, error.message);
                if (attempts < maxAttempts && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
                    console.log('[Snapshot Exporter] Got 401 error, waiting 3 seconds before retry...');
                    sendProgressUpdate(5, `Retrying... (attempt ${attempts + 1}/${maxAttempts})`);
                    await new Promise(resolve => setTimeout(resolve, 3000));
                } else {
                    throw error;
                }
            }
        }

        const snapshotData = response.data;
        console.log('[Snapshot Exporter] Snapshot data received');
        console.log('[Snapshot Exporter] Asset types found:', Object.keys(snapshotData));
        console.log('[Snapshot Exporter] Sample data structure:', JSON.stringify(snapshotData).substring(0, 500));
        sendProgressUpdate(30, 'Processing snapshot assets...');

        if (format === 'xlsx') {
            // Export as single Excel workbook
            sendProgressUpdate(50, 'Creating Excel workbook...');
            const workbook = await convertSnapshotToExcel(snapshotData, snapshotId, companyId);

            sendProgressUpdate(80, 'Generating Excel file...');
            downloadExcel(workbook, snapshotId);

            sendProgressUpdate(100, 'Export complete!');
            console.log('[Snapshot Exporter] Excel export completed successfully');
            return { success: true, filesGenerated: 1, format: 'xlsx' };
        } else {
            // Export as multiple CSV files (original behavior)
            const csvFiles = await convertSnapshotToCSVs(snapshotData, snapshotId);

            sendProgressUpdate(80, 'Generating downloads...');

            // Download all CSV files
            for (let i = 0; i < csvFiles.length; i++) {
                const csvFile = csvFiles[i];
                downloadCSV(csvFile.content, csvFile.filename);
                // Small delay between downloads
                await new Promise(resolve => setTimeout(resolve, 500));

                // Update progress
                const progress = 80 + Math.floor((i + 1) / csvFiles.length * 15);
                sendProgressUpdate(progress, `Downloading file ${i + 1} of ${csvFiles.length}...`);
            }

            sendProgressUpdate(100, 'Export complete!');
            console.log('[Snapshot Exporter] CSV export completed successfully');
            return { success: true, filesGenerated: csvFiles.length, format: 'csv' };
        }

    } catch (error) {
        console.error('[Snapshot Exporter] Export failed:', error);
        sendProgressUpdate(0, `Error: ${error.message}`);
        throw error;
    }
}

/**
 * Convert snapshot data to multiple CSV files (one per asset type)
 */
async function convertSnapshotToCSVs(snapshotData, snapshotId) {
    const csvFiles = [];
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];

    // Define asset types to export
    const assetTypes = [
        { key: 'custom_fields', name: 'Custom_Fields' },
        { key: 'custom_values', name: 'Custom_Values' },
        { key: 'tags', name: 'Tags' },
        { key: 'pipelines', name: 'Pipelines' },
        { key: 'calendars', name: 'Calendars' },
        { key: 'campaigns', name: 'Campaigns' },
        { key: 'forms', name: 'Forms' },
        { key: 'surveys', name: 'Surveys' },
        { key: 'workflow', name: 'Workflows' },
        { key: 'text_templates', name: 'Text_Templates' },
        { key: 'email_templates', name: 'Email_Templates' },
        { key: 'funnels', name: 'Funnels' },
        { key: 'links', name: 'Links' },
        { key: 'folders', name: 'Folders' },
        { key: 'teams', name: 'Teams' },
        { key: 'membership_offers', name: 'Membership_Offers' },
        { key: 'membership_products', name: 'Membership_Products' },
        { key: 'triggers', name: 'Triggers' },
        { key: 'knowledge_bases', name: 'Knowledge_Bases' },
        { key: 'quizzes', name: 'Quizzes' },
        { key: 'dashboards', name: 'Dashboards' },
        { key: 'custom_objects', name: 'Custom_Objects' },
        { key: 'certificates', name: 'Certificates' },
        { key: 'review_settings', name: 'Review_Settings' },
        { key: 'conversation_ai', name: 'Conversation_AI' },
        { key: 'social_planner', name: 'Social_Planner' },
        { key: 'sectionTemplates', name: 'Section_Templates' }
    ];

    // Process each asset type
    for (const assetType of assetTypes) {
        const assets = snapshotData[assetType.key];

        if (assets && assets.length > 0) {
            const csv = convertAssetTypeToCSV(assets);
            const filename = `Snapshot_${snapshotId}_${assetType.name}_${timestamp}.csv`;

            csvFiles.push({
                filename: filename,
                content: csv,
                assetType: assetType.name,
                count: assets.length
            });

            console.log(`[Snapshot Exporter] Generated CSV for ${assetType.name}: ${assets.length} items`);
        }
    }

    // Create a summary CSV
    const summaryCSV = createSummaryCSV(snapshotData, csvFiles, snapshotId);
    csvFiles.unshift({
        filename: `Snapshot_${snapshotId}_SUMMARY_${timestamp}.csv`,
        content: summaryCSV,
        assetType: 'Summary',
        count: csvFiles.length
    });

    return csvFiles;
}

/**
 * Convert snapshot data to Excel workbook with multiple sheets
 */
async function convertSnapshotToExcel(snapshotData, snapshotId, companyId) {
    console.log('[Snapshot Exporter] Converting to Excel workbook');
    console.log('[Snapshot Exporter] Company ID for enrichment:', companyId);

    // First, fetch snapshot metadata to get locationId and additional details
    console.log('[Snapshot Exporter] Fetching snapshot metadata...');
    let locationId = null;
    let snapshotMetadata = {};

    try {
        const snapshotDetailsEndpoint = `/snapshots/snapshotDetails/${snapshotId}?companyId=${companyId}`;
        await window.ghlUtilsRevex.waitForReady();
        const snapshotDetailsResponse = await window.ghlUtilsRevex.get(snapshotDetailsEndpoint);

        if (snapshotDetailsResponse && snapshotDetailsResponse.data) {
            snapshotMetadata = snapshotDetailsResponse.data;
            locationId = snapshotMetadata.locationId;
            console.log('[Snapshot Exporter] ✅ Found locationId:', locationId);
            console.log('[Snapshot Exporter] Snapshot metadata:', {
                name: snapshotMetadata.name,
                type: snapshotMetadata.type,
                dateAdded: snapshotMetadata.dateAdded,
                dateUpdated: snapshotMetadata.dateUpdated
            });
        }
    } catch (error) {
        console.warn('[Snapshot Exporter] Could not fetch snapshot metadata:', error);
    }

    // Create new workbook
    const workbook = XLSX.utils.book_new();

    // Define asset types to export
    const assetTypes = [
        { key: 'custom_fields', name: 'Custom Fields' },
        { key: 'custom_values', name: 'Custom Values' },
        { key: 'tags', name: 'Tags' },
        { key: 'pipelines', name: 'Pipelines' },
        { key: 'calendars', name: 'Calendars' },
        { key: 'campaigns', name: 'Campaigns' },
        { key: 'forms', name: 'Forms' },
        { key: 'surveys', name: 'Surveys' },
        { key: 'workflow', name: 'Workflows' },
        { key: 'text_templates', name: 'Text Templates' },
        { key: 'email_templates', name: 'Email Templates' },
        { key: 'funnels', name: 'Funnels' },
        { key: 'links', name: 'Links' },
        { key: 'folders', name: 'Folders' },
        { key: 'teams', name: 'Teams' },
        { key: 'membership_offers', name: 'Membership Offers' },
        { key: 'membership_products', name: 'Membership Products' },
        { key: 'triggers', name: 'Triggers' },
        { key: 'knowledge_bases', name: 'Knowledge Bases' },
        { key: 'quizzes', name: 'Quizzes' },
        { key: 'dashboards', name: 'Dashboards' },
        { key: 'custom_objects', name: 'Custom Objects' },
        { key: 'certificates', name: 'Certificates' },
        { key: 'review_settings', name: 'Review Settings' },
        { key: 'conversation_ai', name: 'Conversation AI' },
        { key: 'social_planner', name: 'Social Planner' },
        { key: 'sectionTemplates', name: 'Section Templates' }
    ];

    // Create summary data for summary sheet
    const summaryData = [];
    summaryData.push(['GHL Snapshot Export Summary']);
    summaryData.push(['Snapshot ID', snapshotId]);
    summaryData.push(['Snapshot Name', snapshotMetadata.name || 'N/A']);
    summaryData.push(['Location ID', locationId || 'N/A']);
    summaryData.push(['Snapshot Type', snapshotMetadata.type || 'N/A']);
    summaryData.push(['Date Created', snapshotMetadata.dateAdded || 'N/A']);
    summaryData.push(['Date Updated', snapshotMetadata.dateUpdated || 'N/A']);
    summaryData.push(['Export Date', new Date().toISOString()]);
    summaryData.push(['Export Format', 'Excel Workbook (.xlsx)']);
    summaryData.push([]);
    summaryData.push(['Asset Type', 'Count', 'Sheet Name']);

    // Create master list data (all assets combined)
    const masterListData = [];
    masterListData.push(['ID', 'Name', 'Type of Asset']);

    let totalAssets = 0;
    let sheetsCreated = 0;

    // Process each asset type
    for (const assetType of assetTypes) {
        const assets = snapshotData[assetType.key];

        if (assets && assets.length > 0) {
            totalAssets += assets.length;

            // Add to summary
            summaryData.push([assetType.name, assets.length, assetType.name]);

            // Add each asset to master list
            assets.forEach(asset => {
                const id = asset._id || asset.id || asset.ID || '';
                const name = asset.name || asset.title || asset.Name || '';
                masterListData.push([id, name, assetType.name]);
            });

            // Special handling for workflows - fetch full data and add AI analysis
            if (assetType.key === 'workflow' && locationId) {
                console.log('[Snapshot Exporter] ✅ WORKFLOW ENRICHMENT TRIGGERED');
                console.log('[Snapshot Exporter] Processing workflows...');
                console.log('[Snapshot Exporter] Workflow count:', assets.length, 'Company ID:', companyId, 'Snapshot ID:', snapshotId);

                // Check if AI is enabled to show appropriate message
                const aiSettings = await chrome.storage.local.get(['aiAnalysisEnabled']);
                const aiEnabled = aiSettings.aiAnalysisEnabled !== false;
                const progressMsg = aiEnabled
                    ? `Analyzing ${assets.length} workflows with AI...`
                    : `Enriching ${assets.length} workflows...`;
                sendProgressUpdate(35, progressMsg);

                const enrichedWorkflows = await enrichWorkflowsWithAI(assets, companyId, snapshotId);
                const sheetData = convertWorkflowsToArray(enrichedWorkflows);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                // Set custom column widths for workflows - matched to column order
                worksheet['!cols'] = [
                    { wch: 35 }, // Name
                    { wch: 12 }, // Status
                    { wch: 10 }, // Version
                    { wch: 25 }, // Parent Workflow ID
                    { wch: 15 }, // Origin Type
                    { wch: 15 }, // Creation Source
                    { wch: 40 }, // Workflow Notes
                    { wch: 25 }, // Active Hours
                    { wch: 15 }, // Auto Mark Read
                    { wch: 15 }, // Allow Multiple
                    { wch: 20 }, // Allow Multiple Opportunity
                    { wch: 20 }, // Timezone
                    { wch: 15 }, // Stop On Response
                    { wch: 20 }, // Remove From Last Step
                    { wch: 12 }, // Total Steps
                    { wch: 40 }, // Workflow Actions
                    { wch: 30 }, // Triggers
                    { wch: 30 }, // Tags Used
                    { wch: 30 }, // Custom Fields Used
                    { wch: 12 }, // SMS Count
                    { wch: 60 }, // SMS Messages (wide)
                    { wch: 12 }, // Email Count
                    { wch: 60 }, // Email Messages (wide)
                    { wch: 12 }, // Conditions
                    { wch: 12 }, // Splits
                    { wch: 12 }, // Webhooks
                    { wch: 12 }, // API Calls
                    { wch: 20 }, // Created Date
                    { wch: 20 }, // Updated Date
                    { wch: 60 }, // AI Description (wide)
                    { wch: 60 }  // AI Setup Notes (wide)
                ];

                // If there are more columns (from raw workflow data), set default width
                if (sheetData[0] && sheetData[0].length > 31) {
                    for (let i = 31; i < sheetData[0].length; i++) {
                        worksheet['!cols'].push({ wch: 20 });
                    }
                }

                const sheetName = 'Workflows';
                XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
                sheetsCreated++;
                console.log(`[Snapshot Exporter] Created sheet for Workflows with AI analysis: ${assets.length} items`);
            }
            // Special handling for Forms - enrich with full data
            else if (assetType.key === 'forms' && locationId) {
                console.log('[Snapshot Exporter] ✅ FORM ENRICHMENT TRIGGERED');
                sendProgressUpdate(40, `Enriching ${assets.length} forms...`);

                const enrichedForms = await enrichForms(assets, locationId);
                const sheetData = convertAssetTypeToArray(enrichedForms);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Forms');
                sheetsCreated++;
                console.log(`[Snapshot Exporter] Created enriched sheet for Forms: ${assets.length} items`);
            }
            // Special handling for Funnels - enrich with full data
            else if (assetType.key === 'funnels' && locationId) {
                console.log('[Snapshot Exporter] ✅ FUNNEL ENRICHMENT TRIGGERED');
                sendProgressUpdate(45, `Enriching ${assets.length} funnels...`);

                const enrichedFunnels = await enrichFunnels(assets, locationId);
                const sheetData = convertAssetTypeToArray(enrichedFunnels);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Funnels');
                sheetsCreated++;
                console.log(`[Snapshot Exporter] Created enriched sheet for Funnels: ${assets.length} items`);
            }
            // Special handling for Calendars - enrich with full data
            else if (assetType.key === 'calendars' && locationId) {
                console.log('[Snapshot Exporter] ✅ CALENDAR ENRICHMENT TRIGGERED');
                sendProgressUpdate(50, `Enriching ${assets.length} calendars...`);

                const enrichedCalendars = await enrichCalendars(assets, locationId);
                const sheetData = convertAssetTypeToArray(enrichedCalendars);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Calendars');
                sheetsCreated++;
                console.log(`[Snapshot Exporter] Created enriched sheet for Calendars: ${assets.length} items`);
            }
            // Special handling for Pipelines - enrich with full data
            else if (assetType.key === 'pipelines' && locationId) {
                console.log('[Snapshot Exporter] ✅ PIPELINE ENRICHMENT TRIGGERED');
                sendProgressUpdate(55, `Enriching ${assets.length} pipelines...`);

                const enrichedPipelines = await enrichPipelines(assets, locationId);
                const sheetData = convertAssetTypeToArray(enrichedPipelines);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Pipelines');
                sheetsCreated++;
                console.log(`[Snapshot Exporter] Created enriched sheet for Pipelines: ${assets.length} items`);
            }
            // Special handling for Email Templates - enrich with full data
            else if (assetType.key === 'email_templates' && locationId) {
                console.log('[Snapshot Exporter] ✅ EMAIL TEMPLATE ENRICHMENT TRIGGERED');
                sendProgressUpdate(60, `Enriching ${assets.length} email templates...`);

                const enrichedTemplates = await enrichEmailTemplates(assets, locationId);
                const sheetData = convertAssetTypeToArray(enrichedTemplates);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Email Templates');
                sheetsCreated++;
                console.log(`[Snapshot Exporter] Created enriched sheet for Email Templates: ${assets.length} items`);
            }
            else {
                // Normal processing for other asset types
                const sheetData = convertAssetTypeToArray(assets);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                // Set column widths for better readability
                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                // Sanitize sheet name (Excel has 31 char limit and some restricted chars)
                let sheetName = assetType.name.substring(0, 31).replace(/[\[\]\*\/\\\?:]/g, '');
                XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

                sheetsCreated++;
                console.log(`[Snapshot Exporter] Created sheet for ${assetType.name}: ${assets.length} items`);
            }
        } else {
            // Add to summary even if empty
            summaryData.push([assetType.name, 0, 'N/A']);
        }
    }

    // Add totals to summary
    summaryData.push([]);
    summaryData.push(['Total Assets', totalAssets]);
    summaryData.push(['Total Sheets', sheetsCreated + 1]); // +1 for master list

    // Create summary sheet
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

    // Set column widths for summary
    summarySheet['!cols'] = [
        { wch: 25 },
        { wch: 15 },
        { wch: 25 }
    ];

    // Create master list sheet
    const masterListSheet = XLSX.utils.aoa_to_sheet(masterListData);

    // Set column widths for master list
    masterListSheet['!cols'] = [
        { wch: 25 }, // ID
        { wch: 40 }, // Name
        { wch: 20 }  // Type of Asset
    ];

    // Recreate workbook with proper sheet order
    const newWorkbook = XLSX.utils.book_new();

    // Add sheets in order: Summary, Master List, then all asset type sheets
    XLSX.utils.book_append_sheet(newWorkbook, summarySheet, 'Summary');
    XLSX.utils.book_append_sheet(newWorkbook, masterListSheet, 'Master List');

    // Add all other sheets
    workbook.SheetNames.forEach(sheetName => {
        if (sheetName !== 'Summary') {
            XLSX.utils.book_append_sheet(newWorkbook, workbook.Sheets[sheetName], sheetName);
        }
    });

    console.log('[Snapshot Exporter] Excel workbook created with', sheetsCreated + 2, 'sheets (including Summary and Master List)');
    return newWorkbook;
}

/**
 * Convert asset type to 2D array for Excel
 */
function convertAssetTypeToArray(assets) {
    if (!assets || assets.length === 0) {
        return [['No data']];
    }

    // Get all unique keys from all assets
    const allKeys = new Set();
    assets.forEach(asset => {
        Object.keys(asset).forEach(key => allKeys.add(key));
    });

    // Convert to array and sort
    const headers = Array.from(allKeys).sort();

    // Create data array starting with headers
    const dataArray = [headers];

    // Add data rows
    assets.forEach(asset => {
        const row = headers.map(header => {
            const value = asset[header];
            return formatValueForExcel(value);
        });
        dataArray.push(row);
    });

    return dataArray;
}

/**
 * Format a value for Excel output
 */
function formatValueForExcel(value) {
    if (value === null || value === undefined) {
        return '';
    }

    if (typeof value === 'object') {
        // For arrays, join with semicolon
        if (Array.isArray(value)) {
            return value.map(v => formatValueForExcel(v)).join('; ');
        }
        // For objects, stringify
        return JSON.stringify(value);
    }

    return value;
}

/**
 * Download Excel workbook
 */
function downloadExcel(workbook, snapshotId) {
    try {
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const filename = `Snapshot_${snapshotId}_Export_${timestamp}.xlsx`;

        // Generate Excel file
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the URL object
        setTimeout(() => URL.revokeObjectURL(url), 100);

        console.log('[Snapshot Exporter] Downloaded Excel file:', filename);
    } catch (error) {
        console.error('[Snapshot Exporter] Excel download failed:', error);
        throw error;
    }
}

/**
 * Convert a specific asset type array to CSV
 */
function convertAssetTypeToCSV(assets) {
    if (!assets || assets.length === 0) {
        return '';
    }

    // Get all unique keys from all assets
    const allKeys = new Set();
    assets.forEach(asset => {
        Object.keys(asset).forEach(key => allKeys.add(key));
    });

    // Convert to array and sort
    const headers = Array.from(allKeys).sort();

    // Create CSV header row
    let csv = headers.map(h => escapeCSVValue(h)).join(',') + '\n';

    // Add data rows
    assets.forEach(asset => {
        const row = headers.map(header => {
            const value = asset[header];
            return escapeCSVValue(formatValue(value));
        });
        csv += row.join(',') + '\n';
    });

    return csv;
}

/**
 * Create a summary CSV with counts of each asset type
 */
function createSummaryCSV(snapshotData, csvFiles, snapshotId) {
    let csv = `Snapshot Export Summary\nSnapshot ID,${snapshotId}\n`;
    csv += `Export Date,${new Date().toISOString()}\n\n`;
    csv += 'Asset Type,Count,CSV File Generated\n';

    // Add counts for each asset type
    const assetTypes = [
        { key: 'custom_fields', name: 'Custom Fields' },
        { key: 'custom_values', name: 'Custom Values' },
        { key: 'tags', name: 'Tags' },
        { key: 'pipelines', name: 'Pipelines' },
        { key: 'calendars', name: 'Calendars' },
        { key: 'campaigns', name: 'Campaigns' },
        { key: 'forms', name: 'Forms' },
        { key: 'surveys', name: 'Surveys' },
        { key: 'workflow', name: 'Workflows' },
        { key: 'text_templates', name: 'Text Templates' },
        { key: 'email_templates', name: 'Email Templates' },
        { key: 'funnels', name: 'Funnels' },
        { key: 'links', name: 'Links' },
        { key: 'folders', name: 'Folders' },
        { key: 'teams', name: 'Teams' },
        { key: 'membership_offers', name: 'Membership Offers' },
        { key: 'membership_products', name: 'Membership Products' },
        { key: 'triggers', name: 'Triggers' },
        { key: 'knowledge_bases', name: 'Knowledge Bases' },
        { key: 'quizzes', name: 'Quizzes' },
        { key: 'dashboards', name: 'Dashboards' },
        { key: 'custom_objects', name: 'Custom Objects' },
        { key: 'certificates', name: 'Certificates' },
        { key: 'review_settings', name: 'Review Settings' },
        { key: 'conversation_ai', name: 'Conversation AI' },
        { key: 'social_planner', name: 'Social Planner' },
        { key: 'sectionTemplates', name: 'Section Templates' }
    ];

    assetTypes.forEach(assetType => {
        const assets = snapshotData[assetType.key];
        const count = assets ? assets.length : 0;
        const hasCSV = csvFiles.some(f =>
            f.assetType.replace(/_/g, ' ').toLowerCase() === assetType.name.toLowerCase()
        );

        csv += `${assetType.name},${count},${hasCSV ? 'Yes' : 'No'}\n`;
    });

    // Add totals
    const totalAssets = assetTypes.reduce((sum, type) => {
        return sum + (snapshotData[type.key] ? snapshotData[type.key].length : 0);
    }, 0);

    csv += `\nTotal Assets,${totalAssets}\n`;
    csv += `Total CSV Files,${csvFiles.length - 1}\n`;

    return csv;
}

/**
 * Format a value for CSV output
 */
function formatValue(value) {
    if (value === null || value === undefined) {
        return '';
    }

    if (typeof value === 'object') {
        // For arrays, join with semicolon
        if (Array.isArray(value)) {
            return value.map(v => formatValue(v)).join('; ');
        }
        // For objects, stringify
        return JSON.stringify(value);
    }

    return String(value);
}

/**
 * Escape CSV special characters
 */
function escapeCSVValue(value) {
    if (value === null || value === undefined) {
        return '';
    }

    const stringValue = String(value);

    // Check if value needs escaping
    if (stringValue.includes(',') ||
        stringValue.includes('"') ||
        stringValue.includes('\n') ||
        stringValue.includes('\r')) {

        // Escape quotes by doubling them
        const escaped = stringValue.replace(/"/g, '""');
        return `"${escaped}"`;
    }

    return stringValue;
}

/**
 * Download CSV file
 */
function downloadCSV(csvContent, filename) {
    try {
        // Add BOM for proper UTF-8 encoding in Excel
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the URL object
        setTimeout(() => URL.revokeObjectURL(url), 100);

        console.log('[Snapshot Exporter] Downloaded:', filename);
    } catch (error) {
        console.error('[Snapshot Exporter] Download failed:', error);
        throw error;
    }
}

/**
 * Send progress update to popup
 */
function sendProgressUpdate(progress, message) {
    try {
        chrome.runtime.sendMessage({
            action: 'snapshotExportProgress',
            progress: progress,
            message: message
        });
    } catch (error) {
        console.warn('[Snapshot Exporter] Could not send progress update:', error);
    }
}

/**
 * Get current snapshot and company IDs from page
 */
async function getCurrentSnapshotInfo() {
    try {
        // Try to get from URL
        const url = window.location.href;
        const snapshotMatch = url.match(/\/snapshot\/([^\/\?]+)/);

        if (snapshotMatch) {
            const snapshotId = snapshotMatch[1];

            // Try to get company ID from URL first
            const companyMatch = url.match(/[?&]companyId=([^&]+)/);
            let companyId = companyMatch ? companyMatch[1] : null;

            // If not in URL, try Revex (preferred method)
            if (!companyId && window.ghlUtilsRevex) {
                try {
                    console.log('[Snapshot Exporter] Getting company ID from Revex...');
                    companyId = await window.ghlUtilsRevex.getLocationId();
                    console.log('[Snapshot Exporter] Company ID from Revex:', companyId);
                } catch (e) {
                    console.warn('[Snapshot Exporter] Could not get location ID from Revex:', e);
                }
            }

            // Fallback to Chrome storage
            if (!companyId) {
                const result = await chrome.storage.local.get(['companyId', 'locationId']);
                companyId = result.companyId || result.locationId;
                if (companyId) {
                    console.log('[Snapshot Exporter] Company ID from storage:', companyId);
                }
            }

            if (!companyId) {
                throw new Error('Company ID not found. Please provide it manually or ensure you are on a GHL page.');
            }

            console.log('[Snapshot Exporter] Using snapshot ID:', snapshotId, 'company ID:', companyId);
            return { snapshotId, companyId };
        }

        throw new Error('Could not detect snapshot ID from page URL');
    } catch (error) {
        console.error('[Snapshot Exporter] Failed to get snapshot info:', error);
        throw error;
    }
}

/**
 * Export snapshot from current page
 */
async function exportCurrentSnapshot() {
    console.log('[Snapshot Exporter] Exporting current snapshot');

    try {
        const { snapshotId, companyId } = await getCurrentSnapshotInfo();
        console.log('[Snapshot Exporter] Found snapshot:', snapshotId, 'company:', companyId);

        return await exportSnapshotAssets(snapshotId, companyId);
    } catch (error) {
        console.error('[Snapshot Exporter] Failed to export current snapshot:', error);
        throw error;
    }
}

/**
 * Export snapshot with custom IDs (called from popup)
 */
async function exportSnapshotWithIds(snapshotId, companyId, format = 'xlsx') {
    console.log('[Snapshot Exporter] Exporting with IDs:', { snapshotId, companyId, format });

    if (!snapshotId || !companyId) {
        throw new Error('Snapshot ID and Company ID are required');
    }

    return await exportSnapshotAssets(snapshotId, companyId, 'own', format);
}

/**
 * Get company ID from current user
 */
async function getCompanyIdFromUser() {
    console.log('[Snapshot Exporter] Fetching company ID from current user');

    try {
        // Get userId from localStorage
        const authStr = localStorage.getItem('a');
        if (!authStr) {
            throw new Error('No authentication data found');
        }

        const unquoted = JSON.parse(authStr);
        const decoded = atob(unquoted);
        const authData = JSON.parse(decoded);
        const userId = authData.userId;

        if (!userId) {
            throw new Error('User ID not found in auth data');
        }

        console.log('[Snapshot Exporter] Found userId:', userId);

        // Ensure revex is ready
        if (!window.ghlUtilsRevex) {
            throw new Error('Revex authentication not available');
        }

        await window.ghlUtilsRevex.waitForReady();

        // Fetch user data
        const endpoint = `/users/${userId}`;
        console.log('[Snapshot Exporter] Fetching user from endpoint:', endpoint);

        const response = await window.ghlUtilsRevex.get(endpoint);

        if (!response || !response.data) {
            throw new Error('Failed to fetch user data');
        }

        const userData = response.data;
        console.log('[Snapshot Exporter] User data received, companyId:', userData.companyId);

        if (!userData.companyId) {
            throw new Error('Company ID not found in user data');
        }

        return { success: true, companyId: userData.companyId };

    } catch (error) {
        console.error('[Snapshot Exporter] Failed to get company ID:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetch snapshots list for company
 */
async function fetchSnapshotsList(companyId) {
    console.log('[Snapshot Exporter] Fetching snapshots list for company:', companyId);

    try {
        // If no companyId provided, try to get from user
        if (!companyId) {
            console.log('[Snapshot Exporter] No companyId provided, fetching from user');
            const result = await getCompanyIdFromUser();
            if (!result.success) {
                throw new Error(result.error);
            }
            companyId = result.companyId;
            console.log('[Snapshot Exporter] Got companyId from user:', companyId);
        }

        // Ensure revex is ready
        if (!window.ghlUtilsRevex) {
            throw new Error('Revex authentication not available');
        }

        await window.ghlUtilsRevex.waitForReady();

        // Fetch snapshots list
        const endpoint = `/snapshots/v2/${companyId}?companyId=${companyId}&skip=0&limit=20&type=own`;
        console.log('[Snapshot Exporter] Fetching from endpoint:', endpoint);

        const response = await window.ghlUtilsRevex.get(endpoint);

        if (!response || !response.data) {
            throw new Error('Failed to fetch snapshots list');
        }

        const snapshotsData = response.data;
        console.log('[Snapshot Exporter] Snapshots data received:', snapshotsData);

        // Extract snapshots array (API might return { snapshots: [...] } or { data: [...] })
        let snapshots = snapshotsData.snapshots || snapshotsData.data || snapshotsData;

        // Ensure it's an array
        if (!Array.isArray(snapshots)) {
            snapshots = [];
        }

        console.log('[Snapshot Exporter] Found', snapshots.length, 'snapshots');

        return { success: true, snapshots: snapshots, companyId: companyId };

    } catch (error) {
        console.error('[Snapshot Exporter] Failed to fetch snapshots:', error);
        return { success: false, error: error.message };
    }
}

// Listen for messages from popup (Chrome extension messages)
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    console.log('[Snapshot Exporter] Chrome message received:', request.action);

    if (request.action === 'exportSnapshotWithIds') {
        console.log('[Snapshot Exporter] Starting export with IDs:', request.snapshotId, request.companyId, request.format);
        exportSnapshotWithIds(request.snapshotId, request.companyId, request.format || 'xlsx')
            .then(result => {
                console.log('[Snapshot Exporter] Export successful:', result);
                sendResponse({ success: true, result });
            })
            .catch(error => {
                console.error('[Snapshot Exporter] Export failed:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Will respond asynchronously
    }

    if (request.action === 'fetchSnapshotsList') {
        console.log('[Snapshot Exporter] Fetching snapshots list for:', request.companyId);
        fetchSnapshotsList(request.companyId)
            .then(result => {
                console.log('[Snapshot Exporter] Snapshots list fetched:', result);
                sendResponse(result);
            })
            .catch(error => {
                console.error('[Snapshot Exporter] Fetch snapshots failed:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Will respond asynchronously
    }

    console.log('[Snapshot Exporter] Unknown action:', request.action);
    return false;
});

// Listen for custom events from page context (page-exporter.js)
document.addEventListener('ghl-snapshot-export', async (event) => {
    console.log('[Snapshot Exporter] Page context event received:', event.detail.action);

    const { action, snapshotId, companyId, format } = event.detail;

    try {
        let result;

        if (action === 'exportCurrentSnapshot') {
            result = await exportCurrentSnapshot();
        } else if (action === 'exportSnapshotWithIds') {
            result = await exportSnapshotWithIds(snapshotId, companyId, format || 'xlsx');
        } else {
            throw new Error('Unknown action: ' + action);
        }

        // Send success response back to page context
        document.dispatchEvent(new CustomEvent('ghl-snapshot-export-response', {
            detail: {
                action: 'exportComplete',
                result
            }
        }));

    } catch (error) {
        console.error('[Snapshot Exporter] Export failed:', error);

        // Send error response back to page context
        document.dispatchEvent(new CustomEvent('ghl-snapshot-export-response', {
            detail: {
                action: 'exportError',
                error: error.message
            }
        }));
    }
});

// Note: window.ghlSnapshotExporter is exposed by page-exporter.js in the page context
// This content script handles the actual export logic and listens for events from page-exporter.js

console.log('[Snapshot Exporter] Content script initialized and ready to handle export requests');

/**
 * Analyze workflow with AI to generate description and setup notes
 * @param {Object} workflowData - Full workflow data from API
 * @returns {Promise<Object>} - { description, setupNotes }
 */
async function analyzeWorkflowWithAI(workflowData) {
    console.log('[AI Analysis] Starting AI analysis for workflow:', workflowData.name);

    try {
        // Get OpenAI API key and AI settings from storage
        const result = await chrome.storage.local.get(['openaiApiKey', 'aiAnalysisEnabled']);
        const apiKey = result.openaiApiKey;
        const aiEnabled = result.aiAnalysisEnabled !== false; // Default to true

        if (!aiEnabled) {
            console.log('[AI Analysis] AI analysis disabled in settings');
            return {
                description: 'AI analysis disabled',
                setupNotes: ''
            };
        }

        if (!apiKey) {
            console.log('[AI Analysis] No OpenAI API key found');
            return {
                description: '',
                setupNotes: ''
            };
        }

        // Build the prompt
        const prompt = buildWorkflowAnalysisPrompt(workflowData);

        // Call OpenAI API
        console.log('[AI Analysis] Calling OpenAI API...');
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert GoHighLevel (GHL) workflow analyst. Your task is to analyze workflows and create concise documentation for asset management.

Focus on:
1. What the workflow does (its purpose and key actions)
2. What needs to be configured or customized (setup instructions)

Be specific about:
- Triggers and conditions
- Tags, custom fields, pipelines used
- Messages sent (SMS/Email)
- User assignments and notifications
- Any required customizations`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const aiResponse = data.choices[0]?.message?.content || '';

        console.log('[AI Analysis] AI response received');

        // Parse the response
        const parsed = parseAIWorkflowResponse(aiResponse);
        return parsed;

    } catch (error) {
        console.error('[AI Analysis] Error:', error);
        return {
            description: '',
            setupNotes: ''
        };
    }
}

/**
 * Build prompt for workflow analysis
 */
function buildWorkflowAnalysisPrompt(workflowData) {
    const workflowJson = JSON.stringify(workflowData, null, 2);

    return `Analyze this GoHighLevel workflow and provide documentation.

Workflow JSON:
\`\`\`json
${workflowJson}
\`\`\`

Provide your analysis in this EXACT format:

DESCRIPTION:
[Write a single concise sentence (40-60 words) describing what this workflow does. Focus on the main purpose, triggers, and outcomes. Example: "Sends confirmation and reminder messages to both the customer and assigned user to ensure upcoming appointments are attended on time."]

SETUP NOTES:
[List specific setup instructions as comma-separated items. Focus on things that need to be configured or customized. Example: "Add the user to the assign to user action, Add missed call contact tag, Connect to Home Service New Customer Pipeline"]

Be specific and actionable. Only include essential setup steps.`;
}

/**
 * Parse AI response to extract description and setup notes
 */
function parseAIWorkflowResponse(aiResponse) {
    let description = '';
    let setupNotes = '';

    // Split by sections
    const descMatch = aiResponse.match(/DESCRIPTION:\s*\n([\s\S]*?)(?=\n\s*SETUP NOTES:|$)/i);
    const setupMatch = aiResponse.match(/SETUP NOTES:\s*\n([\s\S]*?)$/i);

    if (descMatch) {
        description = descMatch[1].trim();
    }

    if (setupMatch) {
        setupNotes = setupMatch[1].trim();
    }

    // Clean up
    description = description.replace(/\n+/g, ' ').trim();
    setupNotes = setupNotes.replace(/\n+/g, ', ').replace(/^[-•]\s*/gm, '').trim();

    return {
        description: description || '',
        setupNotes: setupNotes || ''
    };
}

/**
 * Enrich workflows with AI-generated descriptions and setup notes
 * @param {Array} workflows - Basic workflow data from snapshot
 * @param {string} companyId - Company/Location ID
 * @param {string} snapshotId - Snapshot ID
 * @returns {Promise<Array>} - Enriched workflows with AI analysis
 */
async function enrichWorkflowsWithAI(workflows, companyId, snapshotId) {
    console.log(`[Workflow Enrichment] Enriching ${workflows.length} workflows`);

    // Check if AI is enabled
    const aiSettings = await chrome.storage.local.get(['aiAnalysisEnabled']);
    const aiEnabled = aiSettings.aiAnalysisEnabled !== false; // Default to true

    if (aiEnabled) {
        console.log('[Workflow Enrichment] AI analysis enabled');
    } else {
        console.log('[Workflow Enrichment] AI analysis disabled - will enrich with API data only');
    }

    // First, fetch the locationId from the snapshot details
    console.log('[Workflow Enrichment] Fetching locationId from snapshot details...');
    const snapshotDetailsEndpoint = `/snapshots/snapshotDetails/${snapshotId}?companyId=${companyId}`;

    let locationId = null;
    try {
        await window.ghlUtilsRevex.waitForReady();
        const snapshotDetailsResponse = await window.ghlUtilsRevex.get(snapshotDetailsEndpoint);

        if (snapshotDetailsResponse && snapshotDetailsResponse.data && snapshotDetailsResponse.data.locationId) {
            locationId = snapshotDetailsResponse.data.locationId;
            console.log('[Workflow Enrichment] ✅ Found locationId:', locationId);
        } else {
            console.error('[Workflow Enrichment] No locationId found in snapshot details');
            throw new Error('No locationId found in snapshot details');
        }
    } catch (error) {
        console.error('[Workflow Enrichment] Failed to fetch snapshot details:', error);
        throw error;
    }

    const enrichedWorkflows = [];
    const startTime = Date.now();
    const timePerWorkflow = [];

    // Process workflows in parallel batches of 3
    const batchSize = 3;
    const batches = [];

    for (let i = 0; i < workflows.length; i += batchSize) {
        batches.push(workflows.slice(i, i + batchSize));
    }

    console.log(`[Workflow Enrichment] Processing ${workflows.length} workflows in ${batches.length} batches of ${batchSize}`);

    let processedCount = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`[Workflow Enrichment] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} workflows)`);

        // Calculate time estimate
        let timeEstimateMsg = '';
        if (processedCount > 0) {
            const avgTimePerWorkflow = timePerWorkflow.reduce((a, b) => a + b, 0) / timePerWorkflow.length;
            const remainingWorkflows = workflows.length - processedCount;
            const estimatedSecondsRemaining = Math.ceil((avgTimePerWorkflow * remainingWorkflows) / 1000);
            const minutes = Math.floor(estimatedSecondsRemaining / 60);
            const seconds = estimatedSecondsRemaining % 60;

            if (minutes > 0) {
                timeEstimateMsg = ` (~${minutes}m ${seconds}s remaining)`;
            } else {
                timeEstimateMsg = ` (~${seconds}s remaining)`;
            }
        }

        // Send progress update
        const progressMsg = aiEnabled
            ? `Analyzing workflows ${processedCount + 1}-${Math.min(processedCount + batch.length, workflows.length)}/${workflows.length}${timeEstimateMsg}`
            : `Enriching workflows ${processedCount + 1}-${Math.min(processedCount + batch.length, workflows.length)}/${workflows.length}${timeEstimateMsg}`;

        sendProgressUpdate(
            35 + Math.floor((processedCount / workflows.length) * 40),
            progressMsg
        );

        // Process all workflows in batch in parallel
        const batchPromises = batch.map(async (workflow, batchIdx) => {
            const workflowStartTime = Date.now();
            const workflowId = workflow._id || workflow.id;
            const workflowName = workflow.name || 'Unnamed Workflow';
            const globalIndex = processedCount + batchIdx;

            console.log(`[Workflow Enrichment] [${globalIndex + 1}/${workflows.length}] Processing: ${workflowName}`);
            console.log(`[Workflow Enrichment] [${globalIndex + 1}] Using locationId: ${locationId}, workflowId: ${workflowId}`);

            try {
                // Fetch full workflow data using locationId
                const endpoint = `/workflow/${locationId}/${workflowId}?includeScheduledPauseInfo=true`;
                console.log(`[Workflow Enrichment] [${globalIndex + 1}] Fetching workflow data:`, endpoint);

                // Wait for Revex to be ready
                if (!window.ghlUtilsRevex) {
                    throw new Error('Revex not available');
                }
                await window.ghlUtilsRevex.waitForReady();

                // Retry logic for 401 errors
                let response = null;
                let attempts = 0;
                const maxAttempts = 3;

                while (!response && attempts < maxAttempts) {
                    attempts++;
                    try {
                        response = await window.ghlUtilsRevex.get(endpoint);
                    } catch (error) {
                        console.error(`[Workflow Enrichment] [${globalIndex + 1}] Attempt ${attempts} failed:`, error.message);
                        if (attempts < maxAttempts && error.message.includes('401')) {
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        } else {
                            throw error;
                        }
                    }
                }

                const fullWorkflowData = response.data;
                const templates = fullWorkflowData.workflowData?.templates || [];

                console.log(`[Workflow Enrichment] [${globalIndex + 1}] Template count: ${templates.length}`);

                // Run AI analysis only if enabled
                let aiAnalysis = { description: '', setupNotes: '' };
                if (aiEnabled) {
                    console.log(`[Workflow Enrichment] [${globalIndex + 1}] Running AI analysis...`);
                    aiAnalysis = await analyzeWorkflowWithAI(fullWorkflowData);
                }

                // Extract all metadata
                const totalSteps = templates.length;
                const triggers = extractTriggers(fullWorkflowData);
                const tagsUsed = extractTags(fullWorkflowData);
                const customFieldsUsed = extractCustomFields(fullWorkflowData);
                const smsCount = countMessageType(fullWorkflowData, 'send_sms');
                const emailCount = countMessageType(fullWorkflowData, 'send_email');
                const conditionCount = countActionType(fullWorkflowData, 'condition');
                const splitCount = countActionType(fullWorkflowData, 'split');
                const webhookCount = countActionType(fullWorkflowData, 'send_webhook');
                const apiCallCount = countActionType(fullWorkflowData, 'http_request');
                const smsMessages = extractSMSMessages(fullWorkflowData);
                const emailMessages = extractEmailMessages(fullWorkflowData);
                const workflowActions = extractWorkflowActions(fullWorkflowData);

                console.log(`[Workflow Enrichment] [${globalIndex + 1}] Extracted: ${totalSteps} steps, ${emailCount} emails, ${smsCount} SMS`);

                const workflowDetails = {
                    ...workflow,
                    version: fullWorkflowData.version || '',
                    status: fullWorkflowData.status || workflow.status || '',
                    createdAt: fullWorkflowData.createdAt || '',
                    updatedAt: fullWorkflowData.updatedAt || '',
                    parentId: fullWorkflowData.parentId || '',
                    originType: fullWorkflowData.originType || '',
                    creationSource: fullWorkflowData.creationSource || '',
                    workflowNote: fullWorkflowData.workflowNote || '',
                    activeHours: formatWorkflowSchedule(fullWorkflowData),
                    autoMarkAsRead: fullWorkflowData.autoMarkAsRead || false,
                    allowMultiple: fullWorkflowData.allowMultiple || false,
                    allowMultipleOpportunity: fullWorkflowData.allowMultipleOpportunity || false,
                    timezone: fullWorkflowData.timezone || '',
                    stopOnResponse: fullWorkflowData.stopOnResponse || false,
                    removeContactFromLastStep: fullWorkflowData.removeContactFromLastStep || false,
                    totalSteps: totalSteps,
                    triggers: triggers,
                    tagsUsed: tagsUsed,
                    customFieldsUsed: customFieldsUsed,
                    smsCount: smsCount,
                    emailCount: emailCount,
                    smsMessages: smsMessages,
                    emailMessages: emailMessages,
                    conditionCount: conditionCount,
                    splitCount: splitCount,
                    webhookCount: webhookCount,
                    apiCallCount: apiCallCount,
                    workflowActions: workflowActions,
                    aiDescription: aiAnalysis.description,
                    aiSetupNotes: aiAnalysis.setupNotes
                };

                const workflowDuration = Date.now() - workflowStartTime;
                console.log(`[Workflow Enrichment] [${globalIndex + 1}] Completed in ${(workflowDuration / 1000).toFixed(1)}s`);

                return { workflowDetails, workflowDuration };

            } catch (error) {
                console.error(`[Workflow Enrichment] [${globalIndex + 1}] Error:`, error);

                const workflowDuration = Date.now() - workflowStartTime;

                const workflowDetails = {
                    ...workflow,
                    version: '',
                    totalSteps: 0,
                    triggers: '',
                    tagsUsed: '',
                    customFieldsUsed: '',
                    smsCount: 0,
                    emailCount: 0,
                    smsMessages: '',
                    emailMessages: '',
                    conditionCount: 0,
                    splitCount: 0,
                    webhookCount: 0,
                    apiCallCount: 0,
                    workflowActions: '',
                    parentId: '',
                    originType: '',
                    creationSource: '',
                    workflowNote: '',
                    activeHours: '',
                    autoMarkAsRead: false,
                    allowMultiple: false,
                    allowMultipleOpportunity: false,
                    timezone: '',
                    stopOnResponse: false,
                    removeContactFromLastStep: false,
                    createdAt: '',
                    updatedAt: '',
                    aiDescription: '',
                    aiSetupNotes: ''
                };

                return { workflowDetails, workflowDuration };
            }
        });

        // Wait for all workflows in batch to complete
        const batchResults = await Promise.all(batchPromises);

        // Add results to enrichedWorkflows array in order
        batchResults.forEach(result => {
            enrichedWorkflows.push(result.workflowDetails);
            timePerWorkflow.push(result.workflowDuration);
        });

        processedCount += batch.length;

        // Rate limiting between batches (only if AI is enabled and not the last batch)
        if (aiEnabled && batchIndex < batches.length - 1) {
            console.log(`[Workflow Enrichment] Waiting 3 seconds before next batch (AI rate limiting)...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    const totalTime = Date.now() - startTime;
    const avgTime = timePerWorkflow.length > 0 ? timePerWorkflow.reduce((a, b) => a + b, 0) / timePerWorkflow.length : 0;
    console.log(`[Workflow Enrichment] All workflows enriched in ${(totalTime / 1000).toFixed(1)}s (avg: ${(avgTime / 1000).toFixed(1)}s per workflow)`);
    return enrichedWorkflows;
}

/**
 * Extract trigger information from workflow data
 */
function extractTriggers(workflowData) {
    const triggers = [];
    const templates = workflowData.workflowData?.templates || [];

    // Look for templates with order 0 (first step) or cat === 'trigger'
    templates.forEach(template => {
        if (template.cat === 'trigger' || template.order === 0) {
            const triggerName = template.name || template.type || 'Unknown Trigger';
            // Only add if not already in the list
            if (!triggers.includes(triggerName)) {
                triggers.push(triggerName);
            }
        }
    });

    // If no triggers found from templates, check for trigger metadata
    if (triggers.length === 0 && workflowData.triggersFilePath) {
        triggers.push('Trigger configured (see workflow)');
    }

    return triggers.length > 0 ? triggers.join('; ') : '';
}

/**
 * Extract tags used in workflow
 */
function extractTags(workflowData) {
    const tags = new Set();
    const templates = workflowData.workflowData?.templates || [];

    templates.forEach(template => {
        const attrs = template.attributes || {};

        // Check for tags array in attributes
        if (attrs.tags && Array.isArray(attrs.tags)) {
            attrs.tags.forEach(tag => tags.add(tag));
        }

        // Check for tag in single tag field
        if (attrs.tag) {
            tags.add(attrs.tag);
        }

        // Look for tag actions (add_tag, remove_tag)
        if (template.type === 'add_tag' || template.type === 'remove_tag') {
            if (attrs.tagId || attrs.tagName) {
                tags.add(attrs.tagName || attrs.tagId);
            }
        }

        // Look for tags in condition branches (for if_else conditions)
        if (attrs.branches && Array.isArray(attrs.branches)) {
            attrs.branches.forEach(branch => {
                if (branch.segments && Array.isArray(branch.segments)) {
                    branch.segments.forEach(segment => {
                        if (segment.conditions && Array.isArray(segment.conditions)) {
                            segment.conditions.forEach(condition => {
                                // Check if condition is checking tags
                                if (condition.conditionSubType === 'tags' && condition.conditionValue) {
                                    if (Array.isArray(condition.conditionValue)) {
                                        condition.conditionValue.forEach(tag => tags.add(tag));
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }
    });

    return Array.from(tags).filter(Boolean).join('; ');
}

/**
 * Extract custom fields referenced in workflow
 */
function extractCustomFields(workflowData) {
    const fields = new Set();
    const templates = workflowData.workflowData?.templates || [];

    console.log(`[extractCustomFields] Processing ${templates.length} templates`);

    templates.forEach((template, idx) => {
        const attrs = template.attributes || {};

        // Check for fields array in attributes (update_contact_field actions)
        if (attrs.fields && Array.isArray(attrs.fields)) {
            console.log(`[extractCustomFields] Template ${idx}: Found attrs.fields array with ${attrs.fields.length} items`);
            attrs.fields.forEach(field => {
                // Add both the field ID and title/name
                if (field.field) fields.add(field.field);
                if (field.title) fields.add(field.title);
                if (field.name) fields.add(field.name);
            });
        }

        // Look for custom fields in condition branches
        if (attrs.branches && Array.isArray(attrs.branches)) {
            attrs.branches.forEach(branch => {
                if (branch.segments && Array.isArray(branch.segments)) {
                    branch.segments.forEach(segment => {
                        if (segment.conditions && Array.isArray(segment.conditions)) {
                            segment.conditions.forEach(condition => {
                                // Check if condition is checking custom fields
                                if (condition.conditionSubType === 'custom_field' ||
                                    condition.conditionSubType === 'customField') {
                                    if (condition.fieldId) fields.add(condition.fieldId);
                                    if (condition.fieldName) fields.add(condition.fieldName);
                                }
                            });
                        }
                    });
                }
            });
        }

        // Look for {{contact.field_name}} or {{contact.custom_fields.field_name}} patterns in HTML/text
        const searchableContent = [
            attrs.html,
            attrs.body,
            attrs.message,
            attrs.subject
        ].filter(Boolean).join(' ');

        if (searchableContent) {
            const contentPreview = searchableContent.substring(0, 100);
            console.log(`[extractCustomFields] Template ${idx} (${template.type}): Searching in content (preview): ${contentPreview}...`);

            // Match {{contact.field_name}} patterns
            const customFieldMatches = searchableContent.matchAll(/\{\{contact\.([a-zA-Z0-9_]+)\}\}/g);
            let matchCount = 0;
            for (const match of customFieldMatches) {
                const fieldName = match[1];
                matchCount++;
                // Exclude standard contact fields
                if (!['first_name', 'last_name', 'email', 'phone', 'name', 'id'].includes(fieldName)) {
                    console.log(`[extractCustomFields] Template ${idx}: Found custom field: ${fieldName}`);
                    fields.add(fieldName);
                } else {
                    console.log(`[extractCustomFields] Template ${idx}: Skipping standard field: ${fieldName}`);
                }
            }

            if (matchCount > 0) {
                console.log(`[extractCustomFields] Template ${idx}: Found ${matchCount} total {{contact.*}} matches`);
            }

            // Match {{contact.custom_fields.field_name}} patterns
            const customFieldsMatches = searchableContent.matchAll(/\{\{contact\.custom_fields\.([a-zA-Z0-9_]+)\}\}/g);
            for (const match of customFieldsMatches) {
                console.log(`[extractCustomFields] Template ${idx}: Found custom_fields match: ${match[1]}`);
                fields.add(match[1]);
            }
        }

        // Check for update_custom_field or update_contact_field actions
        if (template.type === 'update_custom_field' ||
            template.type === 'set_custom_field' ||
            template.type === 'update_contact_field') {
            console.log(`[extractCustomFields] Template ${idx}: Found ${template.type} action`);
            if (attrs.fieldId) fields.add(attrs.fieldId);
            if (attrs.fieldKey) fields.add(attrs.fieldKey);
            if (attrs.fieldName) fields.add(attrs.fieldName);
        }
    });

    const result = Array.from(fields).filter(Boolean).join('; ');
    console.log(`[extractCustomFields] Final result: ${result || '(empty)'}`);
    return result;
}

/**
 * Count specific message type in workflow
 */
function countMessageType(workflowData, messageType) {
    const templates = workflowData.workflowData?.templates || [];

    // Map common variations
    const typeMap = {
        'send_sms': ['sms', 'send_sms', 'send-sms'],
        'send_email': ['email', 'send_email', 'send-email']
    };

    const typesToCheck = typeMap[messageType] || [messageType];

    const matches = templates.filter(t => {
        const templateType = (t.type || '').toLowerCase();
        return typesToCheck.some(type => templateType === type || templateType.includes(type));
    });

    console.log(`[countMessageType] Looking for ${messageType}, checking types: [${typesToCheck.join(', ')}]`);
    console.log(`[countMessageType] All template types found:`, templates.map(t => t.type).join(', '));
    console.log(`[countMessageType] Matched ${matches.length} templates`);

    return matches.length;
}

/**
 * Extract SMS message details from workflow
 */
function extractSMSMessages(workflowData) {
    const smsMessages = [];
    const templates = workflowData.workflowData?.templates || [];

    templates.forEach((template) => {
        const templateType = (template.type || '').toLowerCase();

        if (templateType === 'sms' || templateType === 'send_sms' || templateType === 'send-sms') {
            const attrs = template.attributes || {};
            const name = template.name || 'Unnamed SMS';
            const message = attrs.message || attrs.body || '';

            // Truncate long messages for readability
            const truncatedMessage = message.length > 100
                ? message.substring(0, 100) + '...'
                : message;

            if (truncatedMessage) {
                smsMessages.push(`${name}: ${truncatedMessage}`);
            } else {
                smsMessages.push(name);
            }
        }
    });

    console.log(`[extractSMSMessages] Found ${smsMessages.length} SMS messages`);
    return smsMessages.join(' | ');
}

/**
 * Extract email message details from workflow
 */
function extractEmailMessages(workflowData) {
    const emailMessages = [];
    const templates = workflowData.workflowData?.templates || [];

    templates.forEach((template) => {
        const templateType = (template.type || '').toLowerCase();

        if (templateType === 'email' || templateType === 'send_email' || templateType === 'send-email') {
            const attrs = template.attributes || {};
            const subject = attrs.subject || '';
            const name = template.name || 'Unnamed Email';

            if (subject) {
                emailMessages.push(`${name}: ${subject}`);
            } else {
                emailMessages.push(name);
            }
        }
    });

    console.log(`[extractEmailMessages] Found ${emailMessages.length} email messages`);
    return emailMessages.join(' | ');
}

/**
 * Extract all workflow action types used
 */
function extractWorkflowActions(workflowData) {
    const actions = new Set();
    const templates = workflowData.workflowData?.templates || [];

    templates.forEach(template => {
        if (template.type) {
            // Get friendly name for the action
            const actionName = getFriendlyActionName(template.type);
            actions.add(actionName);
        }
    });

    const result = Array.from(actions).sort().join('; ');
    console.log(`[extractWorkflowActions] Found ${actions.size} unique actions: ${result}`);
    return result;
}

/**
 * Get friendly name for action type
 */
function getFriendlyActionName(type) {
    const typeMap = {
        'wait': 'Wait',
        'email': 'Send Email',
        'send_email': 'Send Email',
        'sms': 'Send SMS',
        'send_sms': 'Send SMS',
        'if_else': 'Condition',
        'split': 'A/B Split',
        'send_webhook': 'Webhook',
        'http_request': 'HTTP Request',
        'add_tag': 'Add Tag',
        'remove_tag': 'Remove Tag',
        'update_contact_field': 'Update Contact Field',
        'update_custom_field': 'Update Custom Field',
        'set_custom_field': 'Set Custom Field',
        'assign_to_user': 'Assign to User',
        'create_opportunity': 'Create Opportunity',
        'update_opportunity': 'Update Opportunity',
        'send_notification': 'Send Notification',
        'add_to_campaign': 'Add to Campaign',
        'remove_from_campaign': 'Remove from Campaign',
        'add_to_workflow': 'Add to Workflow',
        'remove_from_workflow': 'Remove from Workflow',
        'create_task': 'Create Task',
        'update_task': 'Update Task',
        'send_review_request': 'Send Review Request',
        'send_appointment_notification': 'Send Appointment Notification',
        'create_appointment': 'Create Appointment',
        'cancel_appointment': 'Cancel Appointment',
        'facebook_custom_audience': 'Facebook Custom Audience',
        'google_custom_audience': 'Google Custom Audience',
        'manual_action': 'Manual Action',
        'gohighlevel_action': 'GoHighLevel Action'
    };

    return typeMap[type.toLowerCase()] || type;
}

/**
 * Format workflow window/schedule into human-readable string
 */
function formatWorkflowSchedule(workflowData) {
    const window = workflowData.window;

    if (!window) {
        return 'Always Active';
    }

    const condition = window.condition;

    // If condition is 'always' or similar, return that
    if (!condition || condition === 'always') {
        return 'Always Active';
    }

    // Map day numbers to names
    const dayMap = {
        0: 'Sun',
        1: 'Mon',
        2: 'Tue',
        3: 'Wed',
        4: 'Thu',
        5: 'Fri',
        6: 'Sat'
    };

    let scheduleStr = '';

    // Format days
    if (window.days && Array.isArray(window.days) && window.days.length > 0) {
        const sortedDays = [...window.days].sort((a, b) => a - b);

        // Check if all days are selected
        if (sortedDays.length === 7) {
            scheduleStr = 'Every day';
        }
        // Check for weekdays (Mon-Fri)
        else if (sortedDays.length === 5 && sortedDays.every(d => d >= 1 && d <= 5)) {
            scheduleStr = 'Weekdays';
        }
        // Check for weekends
        else if (sortedDays.length === 2 && sortedDays.includes(0) && sortedDays.includes(6)) {
            scheduleStr = 'Weekends';
        }
        // Otherwise list the days
        else {
            scheduleStr = sortedDays.map(d => dayMap[d] || d).join(', ');
        }
    }

    // Format time range
    if (window.start && window.end) {
        const timeStr = `${window.start}-${window.end}`;
        scheduleStr = scheduleStr ? `${scheduleStr} ${timeStr}` : timeStr;
    }

    // Add condition context
    if (condition === 'when') {
        scheduleStr = `Active: ${scheduleStr}`;
    } else if (condition === 'except') {
        scheduleStr = `Active except: ${scheduleStr}`;
    }

    return scheduleStr || 'Always Active';
}

/**
 * Count specific action type in workflow
 */
function countActionType(workflowData, actionType) {
    const templates = workflowData.workflowData?.templates || [];

    console.log(`[countActionType] Looking for action type: ${actionType}`);
    console.log(`[countActionType] All template types:`, templates.map(t => t.type).join(', '));

    // Special handling for conditions
    if (actionType === 'condition') {
        // Count if_else nodes that are actual condition nodes (not branches)
        const matches = templates.filter(t => {
            const templateType = (t.type || '').toLowerCase();
            // if_else with branches = main condition node
            // if_else without branches or with parent = branch node (don't count)
            if (templateType === 'if_else') {
                const attrs = t.attributes || {};
                const isMainCondition = (attrs.branches && attrs.branches.length > 0) || t.nodeType === 'condition-node';
                console.log(`[countActionType] Found if_else template, isMainCondition: ${isMainCondition}, branches: ${attrs.branches?.length || 0}`);
                return isMainCondition;
            }
            return false;
        });
        console.log(`[countActionType] Found ${matches.length} condition nodes`);
        return matches.length;
    }

    const matches = templates.filter(t => {
        const templateType = (t.type || '').toLowerCase();
        const searchType = actionType.toLowerCase();
        return templateType === searchType || templateType.includes(searchType);
    });

    console.log(`[countActionType] Found ${matches.length} ${actionType} actions`);
    return matches.length;
}

/**
 * Enrich forms with full details
 */
async function enrichForms(forms, locationId) {
    if (!forms || forms.length === 0 || !locationId) {
        console.log('[Form Enrichment] No forms to enrich or missing locationId');
        return forms;
    }

    console.log(`[Form Enrichment] Enriching ${forms.length} forms`);
    const enrichedForms = [];

    for (let i = 0; i < forms.length; i++) {
        const form = forms[i];
        const formId = form._id || form.id;
        const formName = form.name || 'Unnamed Form';

        console.log(`[Form Enrichment] [${i + 1}/${forms.length}] Processing: ${formName}`);

        try {
            const endpoint = `/forms/${locationId}/${formId}`;
            await window.ghlUtilsRevex.waitForReady();
            const response = await window.ghlUtilsRevex.get(endpoint);
            const fullFormData = response.data;

            const totalFields = fullFormData.fields ? fullFormData.fields.length : 0;

            const enrichedForm = {
                ...form,
                submissionType: fullFormData.submissionType || '',
                submissionUrl: fullFormData.submissionUrl || '',
                thankyouUrl: fullFormData.thankyouUrl || '',
                pixelId: fullFormData.pixelId || '',
                eventKey: fullFormData.eventKey || '',
                totalFields: totalFields,
                fieldTypes: fullFormData.fields ? extractFieldTypes(fullFormData.fields) : '',
                isActive: fullFormData.isActive || false,
                requiresPayment: fullFormData.requiresPayment || false
            };

            enrichedForms.push(enrichedForm);
            console.log(`[Form Enrichment] [${i + 1}] Enriched: ${totalFields} fields`);
        } catch (error) {
            console.error(`[Form Enrichment] [${i + 1}] Error:`, error);
            enrichedForms.push(form);
        }
    }

    return enrichedForms;
}

/**
 * Enrich funnels with full details
 */
async function enrichFunnels(funnels, locationId) {
    if (!funnels || funnels.length === 0 || !locationId) {
        console.log('[Funnel Enrichment] No funnels to enrich or missing locationId');
        return funnels;
    }

    console.log(`[Funnel Enrichment] Enriching ${funnels.length} funnels`);
    const enrichedFunnels = [];

    for (let i = 0; i < funnels.length; i++) {
        const funnel = funnels[i];
        const funnelId = funnel._id || funnel.id;
        const funnelName = funnel.name || 'Unnamed Funnel';

        console.log(`[Funnel Enrichment] [${i + 1}/${funnels.length}] Processing: ${funnelName}`);

        try {
            const endpoint = `/funnels/${locationId}/${funnelId}`;
            await window.ghlUtilsRevex.waitForReady();
            const response = await window.ghlUtilsRevex.get(endpoint);
            const fullFunnelData = response.data;

            const enrichedFunnel = {
                ...funnel,
                domain: fullFunnelData.domain || '',
                customDomain: fullFunnelData.customDomain || '',
                trackingCode: fullFunnelData.trackingCode || '',
                pageCount: fullFunnelData.pages ? fullFunnelData.pages.length : 0,
                pages: fullFunnelData.pages ? fullFunnelData.pages.map(p => p.name || p.title).join('; ') : '',
                seoTitle: fullFunnelData.seoTitle || '',
                seoDescription: fullFunnelData.seoDescription || '',
                faviconUrl: fullFunnelData.faviconUrl || ''
            };

            enrichedFunnels.push(enrichedFunnel);
            console.log(`[Funnel Enrichment] [${i + 1}] Enriched: ${enrichedFunnel.pageCount} pages`);
        } catch (error) {
            console.error(`[Funnel Enrichment] [${i + 1}] Error:`, error);
            enrichedFunnels.push(funnel);
        }
    }

    return enrichedFunnels;
}

/**
 * Enrich calendars with full details
 */
async function enrichCalendars(calendars, locationId) {
    if (!calendars || calendars.length === 0 || !locationId) {
        console.log('[Calendar Enrichment] No calendars to enrich or missing locationId');
        return calendars;
    }

    console.log(`[Calendar Enrichment] Enriching ${calendars.length} calendars`);
    const enrichedCalendars = [];

    for (let i = 0; i < calendars.length; i++) {
        const calendar = calendars[i];
        const calendarId = calendar._id || calendar.id;
        const calendarName = calendar.name || 'Unnamed Calendar';

        console.log(`[Calendar Enrichment] [${i + 1}/${calendars.length}] Processing: ${calendarName}`);

        try {
            const endpoint = `/calendars/${locationId}/${calendarId}`;
            await window.ghlUtilsRevex.waitForReady();
            const response = await window.ghlUtilsRevex.get(endpoint);
            const fullCalendarData = response.data;

            const enrichedCalendar = {
                ...calendar,
                slug: fullCalendarData.slug || '',
                widgetSlug: fullCalendarData.widgetSlug || '',
                appointmentTitle: fullCalendarData.appointmentTitle || '',
                description: fullCalendarData.description || '',
                eventType: fullCalendarData.eventType || '',
                eventColor: fullCalendarData.eventColor || '',
                meetingLocation: fullCalendarData.meetingLocation || '',
                slotDuration: fullCalendarData.slotDuration || '',
                slotInterval: fullCalendarData.slotInterval || '',
                slotBuffer: fullCalendarData.slotBuffer || '',
                allowReschedule: fullCalendarData.allowReschedule || false,
                allowCancellation: fullCalendarData.allowCancellation || false,
                googleMeetIntegration: fullCalendarData.conferencingProvider === 'google_meet',
                zoomIntegration: fullCalendarData.conferencingProvider === 'zoom',
                conferencingProvider: fullCalendarData.conferencingProvider || '',
                isActive: fullCalendarData.isActive !== false
            };

            enrichedCalendars.push(enrichedCalendar);
            console.log(`[Calendar Enrichment] [${i + 1}] Enriched: ${calendarName}`);
        } catch (error) {
            console.error(`[Calendar Enrichment] [${i + 1}] Error:`, error);
            enrichedCalendars.push(calendar);
        }
    }

    return enrichedCalendars;
}

/**
 * Enrich pipelines with stages and details
 */
async function enrichPipelines(pipelines, locationId) {
    if (!pipelines || pipelines.length === 0 || !locationId) {
        console.log('[Pipeline Enrichment] No pipelines to enrich or missing locationId');
        return pipelines;
    }

    console.log(`[Pipeline Enrichment] Enriching ${pipelines.length} pipelines`);
    const enrichedPipelines = [];

    for (let i = 0; i < pipelines.length; i++) {
        const pipeline = pipelines[i];
        const pipelineId = pipeline._id || pipeline.id;
        const pipelineName = pipeline.name || 'Unnamed Pipeline';

        console.log(`[Pipeline Enrichment] [${i + 1}/${pipelines.length}] Processing: ${pipelineName}`);

        try {
            const endpoint = `/opportunities/pipelines/${locationId}/${pipelineId}`;
            await window.ghlUtilsRevex.waitForReady();
            const response = await window.ghlUtilsRevex.get(endpoint);
            const fullPipelineData = response.data;

            const stages = fullPipelineData.stages || [];
            const stageNames = stages.map(s => s.name).join('; ');

            const enrichedPipeline = {
                ...pipeline,
                stageCount: stages.length,
                stages: stageNames,
                firstStage: stages.length > 0 ? stages[0].name : '',
                lastStage: stages.length > 0 ? stages[stages.length - 1].name : '',
                showInFunnels: fullPipelineData.showInFunnels || false,
                showInContacts: fullPipelineData.showInContacts || false
            };

            enrichedPipelines.push(enrichedPipeline);
            console.log(`[Pipeline Enrichment] [${i + 1}] Enriched: ${stages.length} stages`);
        } catch (error) {
            console.error(`[Pipeline Enrichment] [${i + 1}] Error:`, error);
            enrichedPipelines.push(pipeline);
        }
    }

    return enrichedPipelines;
}

/**
 * Enrich email templates with details
 */
async function enrichEmailTemplates(templates, locationId) {
    if (!templates || templates.length === 0 || !locationId) {
        console.log('[Email Template Enrichment] No templates to enrich or missing locationId');
        return templates;
    }

    console.log(`[Email Template Enrichment] Enriching ${templates.length} templates`);
    const enrichedTemplates = [];

    for (let i = 0; i < templates.length; i++) {
        const template = templates[i];
        const templateId = template._id || template.id;
        const templateName = template.name || 'Unnamed Template';

        console.log(`[Email Template Enrichment] [${i + 1}/${templates.length}] Processing: ${templateName}`);

        try {
            const endpoint = `/templates/${locationId}/${templateId}`;
            await window.ghlUtilsRevex.waitForReady();
            const response = await window.ghlUtilsRevex.get(endpoint);
            const fullTemplateData = response.data;

            // Extract custom fields from template content
            const htmlContent = fullTemplateData.html || fullTemplateData.body || '';
            const customFields = extractCustomFieldsFromContent(htmlContent);

            const enrichedTemplate = {
                ...template,
                subject: fullTemplateData.subject || '',
                fromName: fullTemplateData.fromName || '',
                fromEmail: fullTemplateData.fromEmail || '',
                replyTo: fullTemplateData.replyTo || '',
                customFieldsUsed: customFields,
                hasAttachments: fullTemplateData.attachments && fullTemplateData.attachments.length > 0,
                attachmentCount: fullTemplateData.attachments ? fullTemplateData.attachments.length : 0
            };

            enrichedTemplates.push(enrichedTemplate);
            console.log(`[Email Template Enrichment] [${i + 1}] Enriched: ${templateName}`);
        } catch (error) {
            console.error(`[Email Template Enrichment] [${i + 1}] Error:`, error);
            enrichedTemplates.push(template);
        }
    }

    return enrichedTemplates;
}

/**
 * Extract field types from form fields
 */
function extractFieldTypes(fields) {
    const types = new Set();
    fields.forEach(field => {
        if (field.type) {
            types.add(field.type);
        }
    });
    return Array.from(types).join('; ');
}

/**
 * Extract custom fields from HTML/text content
 */
function extractCustomFieldsFromContent(content) {
    const fields = new Set();

    // Match {{contact.field_name}} patterns
    const customFieldMatches = content.matchAll(/\{\{contact\.([a-zA-Z0-9_]+)\}\}/g);
    for (const match of customFieldMatches) {
        const fieldName = match[1];
        // Exclude standard contact fields
        if (!['first_name', 'last_name', 'email', 'phone', 'name', 'id'].includes(fieldName)) {
            fields.add(fieldName);
        }
    }

    // Match {{contact.custom_fields.field_name}} patterns
    const customFieldsMatches = content.matchAll(/\{\{contact\.custom_fields\.([a-zA-Z0-9_]+)\}\}/g);
    for (const match of customFieldsMatches) {
        fields.add(match[1]);
    }

    return Array.from(fields).filter(Boolean).join('; ');
}

/**
 * Convert workflows with AI analysis to 2D array for Excel
 * Prioritizes technical metadata first, then AI documentation
 */
function convertWorkflowsToArray(workflows) {
    if (!workflows || workflows.length === 0) {
        return [['No workflows found']];
    }

    // Define specific column order for workflows - Technical metadata first, then AI
    const priorityColumns = [
        'name',
        'status',
        'version',
        'parentId',
        'originType',
        'creationSource',
        'workflowNote',
        'activeHours',
        'autoMarkAsRead',
        'allowMultiple',
        'allowMultipleOpportunity',
        'timezone',
        'stopOnResponse',
        'removeContactFromLastStep',
        'totalSteps',
        'workflowActions',
        'triggers',
        'tagsUsed',
        'customFieldsUsed',
        'smsCount',
        'smsMessages',
        'emailCount',
        'emailMessages',
        'conditionCount',
        'splitCount',
        'webhookCount',
        'apiCallCount',
        'createdAt',
        'updatedAt',
        'aiDescription',
        'aiSetupNotes'
    ];

    const columnNames = {
        'name': 'Name',
        'status': 'Status',
        'version': 'Version',
        'parentId': 'Parent Workflow ID',
        'originType': 'Origin Type',
        'creationSource': 'Creation Source',
        'workflowNote': 'Workflow Notes',
        'activeHours': 'Active Hours',
        'autoMarkAsRead': 'Auto Mark Read',
        'allowMultiple': 'Allow Multiple',
        'allowMultipleOpportunity': 'Allow Multiple Opportunity',
        'timezone': 'Timezone',
        'stopOnResponse': 'Stop On Response',
        'removeContactFromLastStep': 'Remove From Last Step',
        'totalSteps': 'Total Steps',
        'workflowActions': 'Workflow Actions',
        'triggers': 'Triggers',
        'tagsUsed': 'Tags Used',
        'customFieldsUsed': 'Custom Fields Used',
        'smsCount': 'SMS Count',
        'smsMessages': 'SMS Messages',
        'emailCount': 'Email Count',
        'emailMessages': 'Email Messages',
        'conditionCount': 'Conditions',
        'splitCount': 'Splits',
        'webhookCount': 'Webhooks',
        'apiCallCount': 'API Calls',
        'createdAt': 'Created Date',
        'updatedAt': 'Updated Date',
        'aiDescription': 'AI Description',
        'aiSetupNotes': 'AI Setup Notes'
    };

    // Get all other keys (excluding priority columns)
    const allKeys = new Set();
    workflows.forEach(workflow => {
        Object.keys(workflow).forEach(key => {
            if (!priorityColumns.includes(key)) {
                allKeys.add(key);
            }
        });
    });

    // Build final column order: priority columns + other columns
    const headers = [
        ...priorityColumns.map(col => columnNames[col] || col),
        ...Array.from(allKeys).sort()
    ];

    const fullColumnKeys = [...priorityColumns, ...Array.from(allKeys).sort()];

    // Create data array starting with headers
    const dataArray = [headers];

    // Add data rows
    workflows.forEach(workflow => {
        const row = fullColumnKeys.map(key => {
            const value = workflow[key];
            return formatValueForExcel(value);
        });
        dataArray.push(row);
    });

    return dataArray;
}
