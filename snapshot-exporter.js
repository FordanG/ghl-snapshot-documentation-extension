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

                // Also create a Calendar Configuration sheet
                console.log('[Snapshot Exporter] Creating Calendar Configuration sheet...');
                sendProgressUpdate(52, `Extracting calendar configuration...`);
                const calendarConfig = await extractCalendarConfiguration(locationId);
                if (calendarConfig) {
                    const configSheetData = convertAssetTypeToArray([calendarConfig]);
                    const configWorksheet = XLSX.utils.aoa_to_sheet(configSheetData);
                    const configColWidths = configSheetData[0].map(() => ({ wch: 20 }));
                    configWorksheet['!cols'] = configColWidths;
                    XLSX.utils.book_append_sheet(workbook, configWorksheet, 'Calendar Configuration');
                    sheetsCreated++;
                    console.log(`[Snapshot Exporter] Created Calendar Configuration sheet`);
                }
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

                // Also create a detailed Pipeline Stages sheet
                console.log('[Snapshot Exporter] Creating Pipeline Stages sheet...');
                sendProgressUpdate(57, `Extracting pipeline stages...`);
                const pipelineStages = await extractPipelineStages(assets, locationId);
                if (pipelineStages && pipelineStages.length > 0) {
                    const stagesSheetData = convertAssetTypeToArray(pipelineStages);
                    const stagesWorksheet = XLSX.utils.aoa_to_sheet(stagesSheetData);
                    const stagesColWidths = stagesSheetData[0].map(() => ({ wch: 20 }));
                    stagesWorksheet['!cols'] = stagesColWidths;
                    XLSX.utils.book_append_sheet(workbook, stagesWorksheet, 'Pipeline Stages');
                    sheetsCreated++;
                    console.log(`[Snapshot Exporter] Created Pipeline Stages sheet: ${pipelineStages.length} stages`);
                }
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
            // Special handling for Surveys - enrich with full data
            else if (assetType.key === 'surveys' && locationId) {
                console.log('[Snapshot Exporter] ✅ SURVEY ENRICHMENT TRIGGERED');
                sendProgressUpdate(65, `Enriching ${assets.length} surveys...`);

                const enrichedSurveys = await enrichSurveys(assets);
                const sheetData = convertAssetTypeToArray(enrichedSurveys);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Surveys');
                sheetsCreated++;
                console.log(`[Snapshot Exporter] Created enriched sheet for Surveys: ${assets.length} items`);
            }
            // Special handling for Campaigns - enrich with statistics
            else if (assetType.key === 'campaigns' && locationId) {
                console.log('[Snapshot Exporter] ✅ CAMPAIGN ENRICHMENT TRIGGERED');
                sendProgressUpdate(68, `Enriching ${assets.length} campaigns...`);

                const enrichedCampaigns = await enrichCampaigns(assets, locationId);
                const sheetData = convertAssetTypeToArray(enrichedCampaigns);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Campaigns');
                sheetsCreated++;
                console.log(`[Snapshot Exporter] Created enriched sheet for Campaigns: ${assets.length} items`);
            }
            // Special handling for Links - enrich with click statistics
            else if (assetType.key === 'links' && locationId) {
                console.log('[Snapshot Exporter] ✅ LINK ENRICHMENT TRIGGERED');
                sendProgressUpdate(70, `Enriching ${assets.length} links...`);

                const enrichedLinks = await enrichLinks(assets, locationId);
                const sheetData = convertAssetTypeToArray(enrichedLinks);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Links');
                sheetsCreated++;
                console.log(`[Snapshot Exporter] Created enriched sheet for Links: ${assets.length} items`);
            }
            // Special handling for Text Templates - enrich with content details
            else if (assetType.key === 'text_templates' && locationId) {
                console.log('[Snapshot Exporter] ✅ TEXT TEMPLATE ENRICHMENT TRIGGERED');
                sendProgressUpdate(72, `Enriching ${assets.length} text templates...`);

                const enrichedTemplates = await enrichTextTemplates(assets, locationId);
                const sheetData = convertAssetTypeToArray(enrichedTemplates);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Text_Templates');
                sheetsCreated++;
                console.log(`[Snapshot Exporter] Created enriched sheet for Text Templates: ${assets.length} items`);
            }
            // Special handling for Membership Offers - enrich with pricing and products
            else if (assetType.key === 'membership_offers' && locationId) {
                console.log('[Snapshot Exporter] ✅ MEMBERSHIP OFFER ENRICHMENT TRIGGERED');
                sendProgressUpdate(75, `Enriching ${assets.length} membership offers...`);

                const enrichedOffers = await enrichMembershipOffers(assets, locationId);
                const sheetData = convertAssetTypeToArray(enrichedOffers);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Membership_Offers');
                sheetsCreated++;
                console.log(`[Snapshot Exporter] Created enriched sheet for Membership Offers: ${assets.length} items`);
            }
            // Special handling for Custom Fields - enrich with folder and model data
            else if (assetType.key === 'custom_fields' && locationId) {
                console.log('[Snapshot Exporter] ✅ CUSTOM FIELD ENRICHMENT TRIGGERED');
                sendProgressUpdate(77, `Enriching ${assets.length} custom fields...`);

                const enrichedFields = await enrichCustomFields(assets, locationId);
                const sheetData = convertAssetTypeToArray(enrichedFields);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Custom_Fields');
                sheetsCreated++;
                console.log(`[Snapshot Exporter] Created enriched sheet for Custom Fields: ${assets.length} items`);
            }
            // Special handling for Custom Values - enrich with organization details
            else if (assetType.key === 'custom_values' && locationId) {
                console.log('[Snapshot Exporter] ✅ CUSTOM VALUE ENRICHMENT TRIGGERED');
                sendProgressUpdate(78, `Enriching ${assets.length} custom values...`);

                const enrichedValues = await enrichCustomValues(assets, locationId);
                const sheetData = convertAssetTypeToArray(enrichedValues);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Custom_Values');
                sheetsCreated++;
                console.log(`[Snapshot Exporter] Created enriched sheet for Custom Values: ${assets.length} items`);
            }
            // Special handling for Tags - enrich with usage statistics
            else if (assetType.key === 'tags' && locationId) {
                console.log('[Snapshot Exporter] ✅ TAG ENRICHMENT TRIGGERED');
                sendProgressUpdate(79, `Enriching ${assets.length} tags...`);

                const enrichedTags = await enrichTags(assets, locationId);
                const sheetData = convertAssetTypeToArray(enrichedTags);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Tags');
                sheetsCreated++;
                console.log(`[Snapshot Exporter] Created enriched sheet for Tags: ${assets.length} items`);
            }
            // Special handling for Knowledge Bases - enrich with files and content
            else if (assetType.key === 'knowledge_bases' && locationId) {
                console.log('[Snapshot Exporter] ✅ KNOWLEDGE BASE ENRICHMENT TRIGGERED');
                sendProgressUpdate(80, `Enriching ${assets.length} knowledge bases...`);

                const enrichedKBs = await enrichKnowledgeBases(assets, locationId);
                const sheetData = convertAssetTypeToArray(enrichedKBs);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Knowledge_Bases');
                sheetsCreated++;
                console.log(`[Snapshot Exporter] Created enriched sheet for Knowledge Bases: ${assets.length} items`);
            }
            // Special handling for Conversation AI - enrich with configuration and metrics
            else if (assetType.key === 'conversation_ai' && locationId) {
                console.log('[Snapshot Exporter] ✅ CONVERSATION AI ENRICHMENT TRIGGERED');
                sendProgressUpdate(81, `Enriching ${assets.length} AI employees...`);

                const enrichedEmployees = await enrichConversationAI(assets, locationId);
                const sheetData = convertAssetTypeToArray(enrichedEmployees);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Conversation_AI');
                sheetsCreated++;
                console.log(`[Snapshot Exporter] Created enriched sheet for Conversation AI: ${assets.length} items`);
            }
            // Special handling for Custom Objects - enrich with schema details
            else if (assetType.key === 'custom_objects' && locationId) {
                console.log('[Snapshot Exporter] ✅ CUSTOM OBJECT ENRICHMENT TRIGGERED');
                sendProgressUpdate(82, `Enriching ${assets.length} custom objects...`);

                const enrichedObjects = await enrichCustomObjects(assets, locationId);
                const sheetData = convertAssetTypeToArray(enrichedObjects);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Custom_Objects');
                sheetsCreated++;
                console.log(`[Snapshot Exporter] Created enriched sheet for Custom Objects: ${assets.length} items`);
            }
            // Special handling for Dashboards - enrich with widgets and permissions
            else if (assetType.key === 'dashboards' && locationId) {
                console.log('[Snapshot Exporter] ✅ DASHBOARD ENRICHMENT TRIGGERED');
                sendProgressUpdate(83, `Enriching ${assets.length} dashboards...`);

                const enrichedDashboards = await enrichDashboards(assets, locationId);
                const sheetData = convertAssetTypeToArray(enrichedDashboards);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Dashboards');
                sheetsCreated++;
                console.log(`[Snapshot Exporter] Created enriched sheet for Dashboards: ${assets.length} items`);
            }
            // Special handling for Quizzes - enrich using forms API (quizzes are a type of form)
            else if (assetType.key === 'quizzes' && locationId) {
                console.log('[Snapshot Exporter] ✅ QUIZ ENRICHMENT TRIGGERED (using Forms API)');
                sendProgressUpdate(84, `Enriching ${assets.length} quizzes...`);

                const enrichedQuizzes = await enrichForms(assets, locationId);
                const sheetData = convertAssetTypeToArray(enrichedQuizzes);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Quizzes');
                sheetsCreated++;
                console.log(`[Snapshot Exporter] Created enriched sheet for Quizzes: ${assets.length} items`);
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
        Object.keys(asset).forEach(key => {
            // Exclude fullEnrichmentData from regular columns - it will be added at the end
            if (key !== 'fullEnrichmentData') {
                allKeys.add(key);
            }
        });
    });

    // Convert to array and sort
    const headers = Array.from(allKeys).sort();

    // Add "Full Enrichment Data" as the last column
    headers.push('Full Enrichment Data');

    // Create data array starting with headers
    const dataArray = [headers];

    // Add data rows
    assets.forEach(asset => {
        const row = headers.map(header => {
            if (header === 'Full Enrichment Data') {
                // Return the full enrichment data as JSON string, truncated to Excel limit
                const jsonString = asset.fullEnrichmentData ? JSON.stringify(asset.fullEnrichmentData, null, 2) : '';
                return truncateToExcelLimit(jsonString);
            }
            const value = asset[header];
            return formatValueForExcel(value);
        });
        dataArray.push(row);
    });

    return dataArray;
}

/**
 * Enforce Excel's maximum cell length (32767 characters)
 * @param {string} text - The text to limit
 * @returns {string} - Text limited to Excel's maximum cell length
 */
function truncateToExcelLimit(text) {
    const MAX_CELL_LENGTH = 32767;

    if (typeof text !== 'string') {
        return text;
    }

    if (text.length <= MAX_CELL_LENGTH) {
        return text;
    }

    // Limit to Excel's maximum cell length
    return text.substring(0, MAX_CELL_LENGTH);
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
            const result = value.map(v => formatValueForExcel(v)).join('; ');
            return truncateToExcelLimit(result);
        }
        // For objects, stringify
        const result = JSON.stringify(value);
        return truncateToExcelLimit(result);
    }

    // Convert to string and truncate
    const result = String(value);
    return truncateToExcelLimit(result);
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
                    aiSetupNotes: aiAnalysis.setupNotes,
                    // Full API data
                    fullEnrichmentData: fullWorkflowData
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
                requiresPayment: fullFormData.requiresPayment || false,
                fullEnrichmentData: fullFormData
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
                faviconUrl: fullFunnelData.faviconUrl || '',
                fullEnrichmentData: fullFunnelData
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
                isActive: fullCalendarData.isActive !== false,
                fullEnrichmentData: fullCalendarData
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
 * Extract calendar configuration for the location
 */
async function extractCalendarConfiguration(locationId) {
    if (!locationId) {
        console.log('[Calendar Config] No locationId provided');
        return null;
    }

    console.log('[Calendar Config] Fetching calendar configuration');

    try {
        const endpoint = `/calendars/configuration/location/${locationId}`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);
        const configData = response.data;

        const config = {
            locationId: configData.locationId || locationId,
            isRentalsEnabled: configData.subAccountConfig?.isRentalsEnabled || false,
            modules: (configData.subAccountConfig?.modules || []).join(', '),
            migratedServicesStatus: configData.migratedServicesStatus || '',
            configId: configData._id || ''
        };

        console.log('[Calendar Config] Configuration extracted successfully');
        return config;
    } catch (error) {
        console.error('[Calendar Config] Error fetching configuration:', error);
        return null;
    }
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
                stagesDetailed: stages, // Include full stage details
                firstStage: stages.length > 0 ? stages[0].name : '',
                lastStage: stages.length > 0 ? stages[stages.length - 1].name : '',
                showInFunnels: fullPipelineData.showInFunnels || false,
                showInContacts: fullPipelineData.showInContacts || false,
                fullEnrichmentData: fullPipelineData
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
 * Extract all pipeline stages into a flat list for detailed stage worksheet
 */
async function extractPipelineStages(pipelines, locationId) {
    if (!pipelines || pipelines.length === 0 || !locationId) {
        console.log('[Pipeline Stages] No pipelines to extract stages from');
        return [];
    }

    console.log(`[Pipeline Stages] Extracting stages from ${pipelines.length} pipelines`);
    const allStages = [];

    for (let i = 0; i < pipelines.length; i++) {
        const pipeline = pipelines[i];
        const pipelineId = pipeline._id || pipeline.id;
        const pipelineName = pipeline.name || 'Unnamed Pipeline';

        console.log(`[Pipeline Stages] [${i + 1}/${pipelines.length}] Extracting from: ${pipelineName}`);

        try {
            const endpoint = `/opportunities/pipelines/${locationId}/${pipelineId}`;
            await window.ghlUtilsRevex.waitForReady();
            const response = await window.ghlUtilsRevex.get(endpoint);
            const fullPipelineData = response.data;

            const stages = fullPipelineData.stages || [];

            // Add each stage with pipeline context
            stages.forEach((stage) => {
                allStages.push({
                    pipelineId: pipelineId,
                    pipelineName: pipelineName,
                    stageId: stage.id,
                    stageName: stage.name,
                    stagePosition: stage.position,
                    originId: stage.originId || '',
                    showInFunnel: stage.showInFunnel !== false,
                    showInPieChart: stage.showInPieChart !== false,
                    dateAdded: fullPipelineData.dateAdded || '',
                    dateUpdated: fullPipelineData.dateUpdated || ''
                });
            });

            console.log(`[Pipeline Stages] [${i + 1}] Extracted: ${stages.length} stages`);
        } catch (error) {
            console.error(`[Pipeline Stages] [${i + 1}] Error:`, error);
        }
    }

    console.log(`[Pipeline Stages] Total stages extracted: ${allStages.length}`);
    return allStages;
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
                attachmentCount: fullTemplateData.attachments ? fullTemplateData.attachments.length : 0,
                fullEnrichmentData: fullTemplateData
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
 * Enrich surveys with full details
 */
async function enrichSurveys(surveys) {
    if (!surveys || surveys.length === 0) {
        console.log('[Survey Enrichment] No surveys to enrich');
        return surveys;
    }

    console.log(`[Survey Enrichment] Enriching ${surveys.length} surveys`);
    const enrichedSurveys = [];

    for (let i = 0; i < surveys.length; i++) {
        const survey = surveys[i];
        const surveyId = survey._id || survey.id;
        const surveyName = survey.name || 'Unnamed Survey';

        console.log(`[Survey Enrichment] [${i + 1}/${surveys.length}] Processing: ${surveyName}`);

        try {
            const endpoint = `/surveys/${surveyId}`;
            await window.ghlUtilsRevex.waitForReady();
            const response = await window.ghlUtilsRevex.get(endpoint);
            const fullSurveyData = response.data;

            const totalPages = fullSurveyData.pages ? fullSurveyData.pages.length : 0;
            const totalQuestions = fullSurveyData.pages
                ? fullSurveyData.pages.reduce((total, page) => total + (page.questions ? page.questions.length : 0), 0)
                : 0;

            const enrichedSurvey = {
                ...survey,
                submissionType: fullSurveyData.submissionType || '',
                submissionUrl: fullSurveyData.submissionUrl || '',
                thankyouUrl: fullSurveyData.thankyouUrl || '',
                pixelId: fullSurveyData.pixelId || '',
                eventKey: fullSurveyData.eventKey || '',
                totalPages: totalPages,
                totalQuestions: totalQuestions,
                isActive: fullSurveyData.isActive || false,
                allowMultipleSubmissions: fullSurveyData.allowMultipleSubmissions || false,
                requireLogin: fullSurveyData.requireLogin || false,
                fullEnrichmentData: fullSurveyData
            };

            enrichedSurveys.push(enrichedSurvey);
            console.log(`[Survey Enrichment] [${i + 1}] Enriched: ${totalPages} pages, ${totalQuestions} questions`);
        } catch (error) {
            console.error(`[Survey Enrichment] [${i + 1}] Error:`, error);
            enrichedSurveys.push(survey);
        }
    }

    return enrichedSurveys;
}

/**
 * Enrich campaigns with statistics and details
 */
async function enrichCampaigns(campaigns, locationId) {
    if (!campaigns || campaigns.length === 0 || !locationId) {
        console.log('[Campaign Enrichment] No campaigns to enrich or missing locationId');
        return campaigns;
    }

    console.log(`[Campaign Enrichment] Enriching ${campaigns.length} campaigns`);
    const enrichedCampaigns = [];

    try {
        // Fetch all campaigns from the API to get full details
        const endpoint = `/emails/campaigns/?locationId=${locationId}&offset=0&limit=1000&search=`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);
        const apiCampaigns = response.data?.campaigns || response.data || [];

        console.log(`[Campaign Enrichment] Fetched ${apiCampaigns.length} campaigns from API`);

        // Create a map for quick lookup
        const campaignMap = new Map();
        apiCampaigns.forEach(camp => {
            const campId = camp._id || camp.id;
            if (campId) {
                campaignMap.set(campId, camp);
            }
        });

        // Enrich each campaign from snapshot with API data
        for (let i = 0; i < campaigns.length; i++) {
            const campaign = campaigns[i];
            const campaignId = campaign._id || campaign.id;
            const campaignName = campaign.name || 'Unnamed Campaign';

            console.log(`[Campaign Enrichment] [${i + 1}/${campaigns.length}] Processing: ${campaignName}`);

            const apiData = campaignMap.get(campaignId);

            if (apiData) {
                const totalSent = apiData.totalSent || apiData.sent || 0;
                const opens = apiData.opens || apiData.opened || 0;
                const clicks = apiData.clicks || apiData.clicked || 0;
                const bounces = apiData.bounces || apiData.bounced || 0;

                const enrichedCampaign = {
                    ...campaign,
                    // Statistics
                    totalSent: totalSent,
                    opens: opens,
                    clicks: clicks,
                    bounces: bounces,
                    openRate: totalSent > 0 ? ((opens / totalSent) * 100).toFixed(2) + '%' : '0%',
                    clickRate: totalSent > 0 ? ((clicks / totalSent) * 100).toFixed(2) + '%' : '0%',
                    bounceRate: totalSent > 0 ? ((bounces / totalSent) * 100).toFixed(2) + '%' : '0%',
                    // Status and metadata
                    status: apiData.status || campaign.status || 'unknown',
                    campaignType: apiData.type || apiData.campaignType || 'email',
                    lastSentAt: apiData.lastSentAt || apiData.sentAt || '',
                    createdBy: apiData.createdBy || campaign.createdBy || '',
                    // Associated resources
                    workflowIds: apiData.workflowIds || campaign.workflowIds || [],
                    templateId: apiData.templateId || campaign.templateId || '',
                    fullEnrichmentData: apiData
                };

                enrichedCampaigns.push(enrichedCampaign);
                console.log(`[Campaign Enrichment] [${i + 1}] Enriched: ${totalSent} sent, ${opens} opens, ${clicks} clicks`);
            } else {
                console.log(`[Campaign Enrichment] [${i + 1}] No API data found, using snapshot data only`);
                enrichedCampaigns.push(campaign);
            }
        }
    } catch (error) {
        console.error(`[Campaign Enrichment] Error fetching campaign data:`, error);
        // Return original campaigns if enrichment fails
        return campaigns;
    }

    return enrichedCampaigns;
}

/**
 * Enrich links with click statistics and trigger details
 */
async function enrichLinks(links, locationId) {
    if (!links || links.length === 0 || !locationId) {
        console.log('[Link Enrichment] No links to enrich or missing locationId');
        return links;
    }

    console.log(`[Link Enrichment] Enriching ${links.length} links`);
    const enrichedLinks = [];

    try {
        // Fetch all links from the API using search endpoint
        const endpoint = `/links/search?locationId=${locationId}&skip=0&limit=1000`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);
        const apiLinks = response.data?.links || response.data || [];

        console.log(`[Link Enrichment] Fetched ${apiLinks.length} links from API`);

        // Create a map for quick lookup
        const linkMap = new Map();
        apiLinks.forEach(link => {
            const linkId = link._id || link.id;
            if (linkId) {
                linkMap.set(linkId, link);
            }
        });

        // Enrich each link from snapshot with API data
        for (let i = 0; i < links.length; i++) {
            const link = links[i];
            const linkId = link._id || link.id;
            const linkName = link.name || 'Unnamed Link';

            console.log(`[Link Enrichment] [${i + 1}/${links.length}] Processing: ${linkName}`);

            const apiData = linkMap.get(linkId);

            if (apiData) {
                const enrichedLink = {
                    ...link,
                    // URL information
                    fullUrl: apiData.url || link.url || '',
                    shortUrl: apiData.shortUrl || `https://link.gohighlevel.com/${apiData.slug || link.slug || ''}`,
                    slug: apiData.slug || link.slug || '',
                    // Click statistics
                    clickCount: apiData.clicks || apiData.clickCount || 0,
                    uniqueClicks: apiData.uniqueClicks || 0,
                    lastClickedAt: apiData.lastClickedAt || '',
                    // Trigger information
                    hasTrigger: !!(apiData.triggers && apiData.triggers.length > 0),
                    triggerCount: apiData.triggers ? apiData.triggers.length : 0,
                    triggerActions: apiData.triggers ? apiData.triggers.map(t => t.type || t.action).join('; ') : '',
                    // Associated workflows
                    workflowIds: apiData.workflowIds || link.workflowIds || [],
                    // Metadata
                    isActive: apiData.isActive !== undefined ? apiData.isActive : true,
                    createdBy: apiData.createdBy || link.createdBy || '',
                    // Full API data
                    fullEnrichmentData: apiData
                };

                enrichedLinks.push(enrichedLink);
                console.log(`[Link Enrichment] [${i + 1}] Enriched: ${enrichedLink.clickCount} clicks, ${enrichedLink.triggerCount} triggers`);
            } else {
                console.log(`[Link Enrichment] [${i + 1}] No API data found, using snapshot data only`);
                enrichedLinks.push(link);
            }
        }
    } catch (error) {
        console.error(`[Link Enrichment] Error fetching link data:`, error);
        // Return original links if enrichment fails
        return links;
    }

    return enrichedLinks;
}

/**
 * Enrich text templates/snippets with content details
 */
async function enrichTextTemplates(templates, locationId) {
    if (!templates || templates.length === 0 || !locationId) {
        console.log('[Text Template Enrichment] No templates to enrich or missing locationId');
        return templates;
    }

    console.log(`[Text Template Enrichment] Enriching ${templates.length} text templates`);
    const enrichedTemplates = [];

    try {
        // Fetch all snippets from the API
        const endpoint = `/snippets/${locationId}?skip=0&limit=1000`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);
        const apiTemplates = response.data?.snippets || response.data || [];

        console.log(`[Text Template Enrichment] Fetched ${apiTemplates.length} templates from API`);

        // Create a map for quick lookup
        const templateMap = new Map();
        apiTemplates.forEach(template => {
            const templateId = template._id || template.id;
            if (templateId) {
                templateMap.set(templateId, template);
            }
        });

        // Enrich each template from snapshot with API data
        for (let i = 0; i < templates.length; i++) {
            const template = templates[i];
            const templateId = template._id || template.id;
            const templateName = template.name || 'Unnamed Template';

            console.log(`[Text Template Enrichment] [${i + 1}/${templates.length}] Processing: ${templateName}`);

            const apiData = templateMap.get(templateId);

            if (apiData) {
                const body = apiData.body || apiData.content || '';
                const enrichedTemplate = {
                    ...template,
                    // Content information
                    bodyPreview: body ? body.substring(0, 200) + (body.length > 200 ? '...' : '') : '',
                    characterCount: body.length,
                    wordCount: body ? body.split(/\s+/).filter(word => word.length > 0).length : 0,
                    // Attachments
                    hasAttachments: !!(apiData.urlAttachments && apiData.urlAttachments.length > 0),
                    attachmentCount: apiData.urlAttachments ? apiData.urlAttachments.length : 0,
                    attachmentUrls: apiData.urlAttachments ? apiData.urlAttachments.join('; ') : '',
                    // Organization
                    folderPath: apiData.folderName || template.folderName || 'Root',
                    isFolder: apiData.isFolder || false,
                    totalSnippets: apiData.isFolder ? (apiData.totalSnippets || 0) : 0,
                    // Metadata
                    createdBy: apiData.createdBy || template.createdBy || '',
                    updatedAt: apiData.updatedAt || apiData.dateUpdated || '',
                    // Full API data
                    fullEnrichmentData: apiData
                };

                enrichedTemplates.push(enrichedTemplate);
                console.log(`[Text Template Enrichment] [${i + 1}] Enriched: ${enrichedTemplate.characterCount} chars, ${enrichedTemplate.attachmentCount} attachments`);
            } else {
                console.log(`[Text Template Enrichment] [${i + 1}] No API data found, using snapshot data only`);
                enrichedTemplates.push(template);
            }
        }
    } catch (error) {
        console.error(`[Text Template Enrichment] Error fetching template data:`, error);
        // Return original templates if enrichment fails
        return templates;
    }

    return enrichedTemplates;
}

/**
 * Enrich membership offers with pricing and product details
 */
async function enrichMembershipOffers(offers, locationId) {
    if (!offers || offers.length === 0 || !locationId) {
        console.log('[Membership Offer Enrichment] No offers to enrich or missing locationId');
        return offers;
    }

    console.log(`[Membership Offer Enrichment] Enriching ${offers.length} membership offers`);
    const enrichedOffers = [];

    try {
        // Fetch membership data from multiple endpoints
        const productsEndpoint = `/membership/locations/${locationId}/products`;
        const offersEndpoint = `/membership/smart-list/offers-products/${locationId}`;
        const siteInfoEndpoint = `/membership/locations/${locationId}/settings/site-info`;

        await window.ghlUtilsRevex.waitForReady();

        // Fetch all data in parallel
        const [productsResponse, offersResponse, siteInfoResponse] = await Promise.allSettled([
            window.ghlUtilsRevex.get(productsEndpoint),
            window.ghlUtilsRevex.get(offersEndpoint),
            window.ghlUtilsRevex.get(siteInfoEndpoint)
        ]);

        const products = productsResponse.status === 'fulfilled' ? (productsResponse.value.data?.products || productsResponse.value.data || []) : [];
        const apiOffers = offersResponse.status === 'fulfilled' ? (offersResponse.value.data?.offers || offersResponse.value.data || []) : [];
        const siteInfo = siteInfoResponse.status === 'fulfilled' ? (siteInfoResponse.value.data || {}) : {};

        console.log(`[Membership Offer Enrichment] Fetched ${products.length} products, ${apiOffers.length} offers`);

        // Create maps for quick lookup
        const offerMap = new Map();
        apiOffers.forEach(offer => {
            const offerId = offer._id || offer.id;
            if (offerId) {
                offerMap.set(offerId, offer);
            }
        });

        const productMap = new Map();
        products.forEach(product => {
            const productId = product._id || product.id;
            if (productId) {
                productMap.set(productId, product);
            }
        });

        // Enrich each offer from snapshot with API data
        for (let i = 0; i < offers.length; i++) {
            const offer = offers[i];
            const offerId = offer._id || offer.id;
            const offerName = offer.name || 'Unnamed Offer';

            console.log(`[Membership Offer Enrichment] [${i + 1}/${offers.length}] Processing: ${offerName}`);

            const apiData = offerMap.get(offerId);

            if (apiData) {
                // Get associated products
                const productIds = apiData.products || apiData.productIds || [];
                const associatedProducts = productIds
                    .map(pid => productMap.get(pid))
                    .filter(Boolean)
                    .map(p => p.name)
                    .join('; ');

                const enrichedOffer = {
                    ...offer,
                    // Pricing information
                    priceAmount: apiData.price || offer.price || 0,
                    currency: apiData.currency || offer.currency || 'USD',
                    billingCycle: apiData.recurringType || apiData.billingCycle || 'one-time',
                    trialPeriod: apiData.trialPeriod || apiData.trial || 0,
                    // Product associations
                    productCount: productIds.length,
                    productNames: associatedProducts,
                    // Site information
                    siteDomain: siteInfo.customDomain || siteInfo.subdomain || '',
                    siteName: siteInfo.name || siteInfo.title || '',
                    // Status
                    isActive: apiData.isActive !== undefined ? apiData.isActive : true,
                    isPublished: apiData.isPublished || apiData.published || false,
                    // Metadata
                    description: apiData.description || offer.description || '',
                    createdBy: apiData.createdBy || offer.createdBy || '',
                    // Full API data
                    fullEnrichmentData: apiData
                };

                enrichedOffers.push(enrichedOffer);
                console.log(`[Membership Offer Enrichment] [${i + 1}] Enriched: $${enrichedOffer.priceAmount} ${enrichedOffer.currency}, ${enrichedOffer.productCount} products`);
            } else {
                console.log(`[Membership Offer Enrichment] [${i + 1}] No API data found, using snapshot data only`);
                enrichedOffers.push(offer);
            }
        }
    } catch (error) {
        console.error(`[Membership Offer Enrichment] Error fetching membership data:`, error);
        // Return original offers if enrichment fails
        return offers;
    }

    return enrichedOffers;
}

/**
 * Enrich custom fields with folder structure and model associations
 */
async function enrichCustomFields(customFields, locationId) {
    if (!customFields || customFields.length === 0 || !locationId) {
        console.log('[Custom Field Enrichment] No custom fields to enrich or missing locationId');
        return customFields;
    }

    console.log(`[Custom Field Enrichment] Enriching ${customFields.length} custom fields`);
    const enrichedFields = [];

    try {
        // Fetch all custom fields with full details using search endpoint
        const endpoint = `/locations/${locationId}/customFields/search?parentId=&skip=0&limit=1000&documentType=&model=all&query=&includeStandards=false`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);
        const apiFields = response.data?.customFields || response.data || [];

        console.log(`[Custom Field Enrichment] Fetched ${apiFields.length} custom fields from API`);

        // Create a map for quick lookup
        const fieldMap = new Map();
        apiFields.forEach(field => {
            const fieldId = field._id || field.id;
            if (fieldId) {
                fieldMap.set(fieldId, field);
            }
        });

        // Enrich each custom field from snapshot with API data
        for (let i = 0; i < customFields.length; i++) {
            const field = customFields[i];
            const fieldId = field._id || field.id;
            const fieldName = field.name || 'Unnamed Field';

            console.log(`[Custom Field Enrichment] [${i + 1}/${customFields.length}] Processing: ${fieldName}`);

            const apiData = fieldMap.get(fieldId);

            if (apiData) {
                const enrichedField = {
                    ...field,
                    // Field type and configuration
                    dataType: apiData.dataType || apiData.type || field.dataType || '',
                    fieldType: apiData.fieldType || field.fieldType || '',
                    // Model associations
                    model: apiData.model || field.model || 'contact',
                    applicableModels: apiData.applicableModels || [apiData.model || field.model || 'contact'],
                    // Organization
                    folderName: apiData.folderName || apiData.parentName || field.folderName || 'Root',
                    parentId: apiData.parentId || field.parentId || '',
                    position: apiData.position || field.position || 0,
                    // Field properties
                    isRequired: apiData.isRequired || field.isRequired || false,
                    isUnique: apiData.isUnique || field.isUnique || false,
                    isSearchable: apiData.isSearchable || field.isSearchable || false,
                    placeholder: apiData.placeholder || field.placeholder || '',
                    // Options for select/dropdown fields
                    hasOptions: !!(apiData.options && apiData.options.length > 0),
                    optionCount: apiData.options ? apiData.options.length : 0,
                    options: apiData.options ? apiData.options.map(opt => opt.name || opt.label || opt).join('; ') : '',
                    // Metadata
                    createdBy: apiData.createdBy || field.createdBy || '',
                    updatedAt: apiData.updatedAt || field.updatedAt || '',
                    // Full API data
                    fullEnrichmentData: apiData
                };

                enrichedFields.push(enrichedField);
                console.log(`[Custom Field Enrichment] [${i + 1}] Enriched: ${enrichedField.dataType}, ${enrichedField.model}, ${enrichedField.optionCount} options`);
            } else {
                console.log(`[Custom Field Enrichment] [${i + 1}] No API data found, using snapshot data only`);
                enrichedFields.push(field);
            }
        }
    } catch (error) {
        console.error(`[Custom Field Enrichment] Error fetching custom field data:`, error);
        // Return original fields if enrichment fails
        return customFields;
    }

    return enrichedFields;
}

/**
 * Enrich custom values with usage and organization details
 */
async function enrichCustomValues(customValues, locationId) {
    if (!customValues || customValues.length === 0 || !locationId) {
        console.log('[Custom Value Enrichment] No custom values to enrich or missing locationId');
        return customValues;
    }

    console.log(`[Custom Value Enrichment] Enriching ${customValues.length} custom values`);
    const enrichedValues = [];

    try {
        // Fetch all custom values from the API
        const endpoint = `/locations/${locationId}/customValues/`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);
        const apiValues = response.data?.customValues || response.data || [];

        console.log(`[Custom Value Enrichment] Fetched ${apiValues.length} custom values from API`);

        // Create a map for quick lookup
        const valueMap = new Map();
        apiValues.forEach(value => {
            const valueId = value._id || value.id;
            if (valueId) {
                valueMap.set(valueId, value);
            }
        });

        // Enrich each custom value from snapshot with API data
        for (let i = 0; i < customValues.length; i++) {
            const value = customValues[i];
            const valueId = value._id || value.id;
            const valueName = value.name || 'Unnamed Value';

            console.log(`[Custom Value Enrichment] [${i + 1}/${customValues.length}] Processing: ${valueName}`);

            const apiData = valueMap.get(valueId);

            if (apiData) {
                const enrichedValue = {
                    ...value,
                    // Value details
                    value: apiData.value || value.value || '',
                    type: apiData.type || value.type || 'text',
                    // Organization
                    category: apiData.category || value.category || '',
                    description: apiData.description || value.description || '',
                    // Metadata
                    isActive: apiData.isActive !== undefined ? apiData.isActive : true,
                    createdBy: apiData.createdBy || value.createdBy || '',
                    updatedAt: apiData.updatedAt || value.updatedAt || '',
                    // Full API data
                    fullEnrichmentData: apiData
                };

                enrichedValues.push(enrichedValue);
                console.log(`[Custom Value Enrichment] [${i + 1}] Enriched: ${enrichedValue.type}, category: ${enrichedValue.category || 'none'}`);
            } else {
                console.log(`[Custom Value Enrichment] [${i + 1}] No API data found, using snapshot data only`);
                enrichedValues.push(value);
            }
        }
    } catch (error) {
        console.error(`[Custom Value Enrichment] Error fetching custom value data:`, error);
        // Return original values if enrichment fails
        return customValues;
    }

    return enrichedValues;
}

/**
 * Enrich tags with usage statistics and organization details
 */
async function enrichTags(tags, locationId) {
    if (!tags || tags.length === 0 || !locationId) {
        console.log('[Tag Enrichment] No tags to enrich or missing locationId');
        return tags;
    }

    console.log(`[Tag Enrichment] Enriching ${tags.length} tags`);
    const enrichedTags = [];

    try {
        // Try to fetch all tags from the API
        // Based on permissions, the endpoint should be /locations/{locationId}/tags
        const endpoint = `/locations/${locationId}/tags`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);
        const apiTags = response.data?.tags || response.data || [];

        console.log(`[Tag Enrichment] Fetched ${apiTags.length} tags from API`);

        // Create a map for quick lookup
        const tagMap = new Map();
        apiTags.forEach(tag => {
            const tagId = tag._id || tag.id;
            if (tagId) {
                tagMap.set(tagId, tag);
            }
        });

        // Enrich each tag from snapshot with API data
        for (let i = 0; i < tags.length; i++) {
            const tag = tags[i];
            const tagId = tag._id || tag.id;
            const tagName = tag.name || 'Unnamed Tag';

            console.log(`[Tag Enrichment] [${i + 1}/${tags.length}] Processing: ${tagName}`);

            const apiData = tagMap.get(tagId);

            if (apiData) {
                const enrichedTag = {
                    ...tag,
                    // Tag details
                    name: apiData.name || tag.name || '',
                    color: apiData.color || tag.color || '',
                    // Usage statistics
                    contactCount: apiData.contactCount || apiData.usageCount || 0,
                    opportunityCount: apiData.opportunityCount || 0,
                    totalUsage: (apiData.contactCount || 0) + (apiData.opportunityCount || 0),
                    // Organization
                    category: apiData.category || tag.category || '',
                    description: apiData.description || tag.description || '',
                    // Metadata
                    isActive: apiData.isActive !== undefined ? apiData.isActive : true,
                    createdAt: apiData.createdAt || tag.createdAt || '',
                    createdBy: apiData.createdBy || tag.createdBy || '',
                    lastUsedAt: apiData.lastUsedAt || '',
                    // Full API data
                    fullEnrichmentData: apiData
                };

                enrichedTags.push(enrichedTag);
                console.log(`[Tag Enrichment] [${i + 1}] Enriched: ${enrichedTag.contactCount} contacts, ${enrichedTag.opportunityCount} opportunities`);
            } else {
                console.log(`[Tag Enrichment] [${i + 1}] No API data found, using snapshot data only`);
                enrichedTags.push(tag);
            }
        }
    } catch (error) {
        console.error(`[Tag Enrichment] Error fetching tag data:`, error);
        console.log('[Tag Enrichment] Tags endpoint may not be available, returning snapshot data');
        // Return original tags if enrichment fails (endpoint might not exist)
        return tags;
    }

    return enrichedTags;
}

/**
 * Enrich knowledge bases with files, content, and usage details
 */
async function enrichKnowledgeBases(knowledgeBases, locationId) {
    if (!knowledgeBases || knowledgeBases.length === 0 || !locationId) {
        console.log('[Knowledge Base Enrichment] No knowledge bases to enrich or missing locationId');
        return knowledgeBases;
    }

    console.log(`[Knowledge Base Enrichment] Enriching ${knowledgeBases.length} knowledge bases`);
    const enrichedKBs = [];

    try {
        // Fetch all knowledge bases from API
        const endpoint = `/knowledge-base/all?locationId=${locationId}`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);
        const apiKBs = response.data?.knowledgeBases || response.data?.data?.knowledgeBases || [];

        console.log(`[Knowledge Base Enrichment] Fetched ${apiKBs.length} knowledge bases from API`);

        // Create a map for quick lookup
        const kbMap = new Map();
        apiKBs.forEach(kb => {
            const kbId = kb.id || kb._id;
            if (kbId) {
                kbMap.set(kbId, kb);
            }
        });

        // Enrich each knowledge base
        for (let i = 0; i < knowledgeBases.length; i++) {
            const kb = knowledgeBases[i];
            const kbId = kb.id || kb._id;
            const kbName = kb.name || 'Unnamed Knowledge Base';

            console.log(`[Knowledge Base Enrichment] [${i + 1}/${knowledgeBases.length}] Processing: ${kbName}`);

            const apiData = kbMap.get(kbId);

            if (apiData && kbId) {
                // Try to fetch detailed information for this knowledge base
                let kbDetails = null;
                let kbFiles = [];

                try {
                    // Fetch KB details
                    const detailsResponse = await window.ghlUtilsRevex.get(`/knowledge-base/${kbId}`);
                    kbDetails = detailsResponse.data || detailsResponse.data?.data || null;
                    console.log(`[Knowledge Base Enrichment] [${i + 1}] Fetched details for ${kbName}`);
                } catch (error) {
                    console.log(`[Knowledge Base Enrichment] [${i + 1}] Could not fetch details: ${error.message}`);
                }

                try {
                    // Fetch KB files
                    const filesResponse = await window.ghlUtilsRevex.get(`/knowledge-base/files/all?knowledgeBaseId=${kbId}`);
                    kbFiles = filesResponse.data?.files || filesResponse.data?.data?.files || [];
                    console.log(`[Knowledge Base Enrichment] [${i + 1}] Fetched ${kbFiles.length} files`);
                } catch (error) {
                    console.log(`[Knowledge Base Enrichment] [${i + 1}] Could not fetch files: ${error.message}`);
                }

                const enrichedKB = {
                    ...kb,
                    // Basic info
                    name: apiData.name || kb.name || '',
                    isDefault: apiData.isDefault || kb.isDefault || false,
                    createdAt: apiData.createdAt || kb.createdAt || '',
                    // Details from detailed endpoint
                    description: kbDetails?.description || kb.description || '',
                    // File statistics
                    totalFiles: kbFiles.length || 0,
                    fileTypes: kbFiles.length > 0 ? [...new Set(kbFiles.map(f => f.fileType || f.type).filter(Boolean))].join('; ') : '',
                    totalFileSize: kbFiles.reduce((sum, f) => sum + (f.size || 0), 0),
                    fileNames: kbFiles.length > 0 ? kbFiles.map(f => f.name || f.fileName).filter(Boolean).join('; ') : '',
                    // Content statistics
                    hasWebsiteContent: kbDetails?.hasWebsiteContent || false,
                    hasRichTextContent: kbDetails?.hasRichTextContent || false,
                    // Metadata
                    updatedAt: apiData.updatedAt || kbDetails?.updatedAt || kb.updatedAt || '',
                    updatedBy: apiData.updatedBy || kbDetails?.updatedBy || kb.updatedBy || '',
                    // Full API data
                    fullEnrichmentData: {
                        apiKB: apiData,
                        details: kbDetails,
                        files: kbFiles
                    }
                };

                enrichedKBs.push(enrichedKB);
                console.log(`[Knowledge Base Enrichment] [${i + 1}] Enriched: ${enrichedKB.totalFiles} files, ${enrichedKB.totalFileSize} bytes`);
            } else {
                console.log(`[Knowledge Base Enrichment] [${i + 1}] No API data found, using snapshot data only`);
                enrichedKBs.push(kb);
            }

            // Add delay to avoid rate limiting
            if (i < knowledgeBases.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
    } catch (error) {
        console.error(`[Knowledge Base Enrichment] Error fetching knowledge base data:`, error);
        console.log('[Knowledge Base Enrichment] Returning snapshot data');
        return knowledgeBases;
    }

    return enrichedKBs;
}

/**
 * Enrich conversation AI employees with configuration and performance metrics
 */
async function enrichConversationAI(aiEmployees, locationId) {
    if (!aiEmployees || aiEmployees.length === 0 || !locationId) {
        console.log('[Conversation AI Enrichment] No AI employees to enrich or missing locationId');
        return aiEmployees;
    }

    console.log(`[Conversation AI Enrichment] Enriching ${aiEmployees.length} AI employees`);
    const enrichedEmployees = [];

    try {
        // Fetch all AI employees from API
        const endpoint = `/ai-employees/employees/search?limit=1000&query=&locationId=${locationId}`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);
        const apiEmployees = response.data?.employees || response.data || [];

        console.log(`[Conversation AI Enrichment] Fetched ${apiEmployees.length} AI employees from API`);

        // Create a map for quick lookup
        const employeeMap = new Map();
        apiEmployees.forEach(employee => {
            const employeeId = employee.id || employee._id;
            if (employeeId) {
                employeeMap.set(employeeId, employee);
            }
        });

        // Enrich each AI employee
        for (let i = 0; i < aiEmployees.length; i++) {
            const employee = aiEmployees[i];
            const employeeId = employee.id || employee._id;
            const employeeName = employee.name || 'Unnamed AI Employee';

            console.log(`[Conversation AI Enrichment] [${i + 1}/${aiEmployees.length}] Processing: ${employeeName}`);

            const apiData = employeeMap.get(employeeId);

            if (apiData) {
                const enrichedEmployee = {
                    ...employee,
                    // Basic info
                    name: apiData.name || employee.name || '',
                    mode: apiData.mode || employee.mode || 'off',
                    botType: apiData.botType || employee.botType || '',
                    businessName: apiData.businessName || employee.businessName || '',
                    // Configuration
                    waitTime: apiData.waitTime || employee.waitTime || 0,
                    waitTimeUnit: apiData.waitTimeUnit || employee.waitTimeUnit || 'seconds',
                    sleepTime: apiData.sleepTime || employee.sleepTime || 0,
                    sleepTimeUnit: apiData.sleepTimeUnit || employee.sleepTimeUnit || 'hours',
                    sleepEnabled: apiData.sleepEnabled !== undefined ? apiData.sleepEnabled : false,
                    autoPilotMaxMessages: apiData.autoPilotMaxMessages || employee.autoPilotMaxMessages || 0,
                    // Goal and prompt
                    goalType: apiData.goal?.type || employee.goal?.type || '',
                    goalPrompt: apiData.goal?.prompt || employee.goal?.prompt || '',
                    promptId: apiData.prompt || employee.prompt || '',
                    // Actions
                    totalActions: apiData.actions?.length || employee.actions?.length || 0,
                    actionTypes: apiData.actions?.length > 0
                        ? [...new Set(apiData.actions.map(a => a.type).filter(Boolean))].join('; ')
                        : '',
                    // Knowledge bases
                    knowledgeBaseIds: apiData.knowledgeBaseIds?.join('; ') || employee.knowledgeBaseIds?.join('; ') || '',
                    totalKnowledgeBases: apiData.knowledgeBaseIds?.length || employee.knowledgeBaseIds?.length || 0,
                    // Channels
                    channels: apiData.channels?.map(c => c.name).join('; ') || employee.channels?.map(c => c.name).join('; ') || '',
                    primaryChannels: apiData.channels?.filter(c => c.isPrimary).map(c => c.name).join('; ') || '',
                    isPrimary: apiData.isPrimary !== undefined ? apiData.isPrimary : employee.isPrimary,
                    // Status
                    deleted: apiData.deleted !== undefined ? apiData.deleted : false,
                    // Metadata
                    createdAt: apiData.createdAt || employee.createdAt || '',
                    updatedAt: apiData.updatedAt || employee.updatedAt || '',
                    updatedByUserId: apiData.updatedBy?.userId || employee.updatedBy?.userId || '',
                    updatedByTimestamp: apiData.updatedBy?.timestamp || employee.updatedBy?.timestamp || '',
                    // Full API data
                    fullEnrichmentData: apiData
                };

                enrichedEmployees.push(enrichedEmployee);
                console.log(`[Conversation AI Enrichment] [${i + 1}] Enriched: ${enrichedEmployee.totalActions} actions, ${enrichedEmployee.totalKnowledgeBases} KBs, mode: ${enrichedEmployee.mode}`);
            } else {
                console.log(`[Conversation AI Enrichment] [${i + 1}] No API data found, using snapshot data only`);
                enrichedEmployees.push(employee);
            }
        }
    } catch (error) {
        console.error(`[Conversation AI Enrichment] Error fetching AI employee data:`, error);
        console.log('[Conversation AI Enrichment] Returning snapshot data');
        return aiEmployees;
    }

    return enrichedEmployees;
}

/**
 * Enrich custom objects with schema and configuration details
 */
async function enrichCustomObjects(customObjects, locationId) {
    if (!customObjects || customObjects.length === 0 || !locationId) {
        console.log('[Custom Object Enrichment] No custom objects to enrich or missing locationId');
        return customObjects;
    }

    console.log(`[Custom Object Enrichment] Enriching ${customObjects.length} custom objects`);
    const enrichedObjects = [];

    try {
        // Fetch all custom objects from API
        const endpoint = `/objects/?locationId=${locationId}`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);
        const apiObjects = response.data?.objects || response.data || [];

        console.log(`[Custom Object Enrichment] Fetched ${apiObjects.length} custom objects from API`);

        // Create a map for quick lookup
        const objectMap = new Map();
        apiObjects.forEach(obj => {
            const objId = obj.id || obj._id;
            if (objId) {
                objectMap.set(objId, obj);
            }
        });

        // Enrich each custom object
        for (let i = 0; i < customObjects.length; i++) {
            const obj = customObjects[i];
            const objId = obj.id || obj._id;
            const objName = obj.name || 'Unnamed Custom Object';

            console.log(`[Custom Object Enrichment] [${i + 1}/${customObjects.length}] Processing: ${objName}`);

            const apiData = objectMap.get(objId);

            if (apiData) {
                const enrichedObject = {
                    ...obj,
                    // Basic info
                    name: apiData.name || obj.name || '',
                    objectName: apiData.objectName || obj.objectName || '',
                    type: apiData.type || obj.type || '',
                    // Schema details
                    totalFields: apiData.fields?.length || obj.fields?.length || 0,
                    fieldNames: apiData.fields?.length > 0
                        ? apiData.fields.map(f => f.name || f.label).filter(Boolean).join('; ')
                        : (obj.fields?.length > 0 ? obj.fields.map(f => f.name || f.label).filter(Boolean).join('; ') : ''),
                    fieldTypes: apiData.fields?.length > 0
                        ? [...new Set(apiData.fields.map(f => f.type).filter(Boolean))].join('; ')
                        : (obj.fields?.length > 0 ? [...new Set(obj.fields.map(f => f.type).filter(Boolean))].join('; ') : ''),
                    requiredFields: apiData.fields?.filter(f => f.required).map(f => f.name).join('; ') || '',
                    // Configuration
                    isEnabled: apiData.isEnabled !== undefined ? apiData.isEnabled : obj.isEnabled,
                    isSystem: apiData.isSystem !== undefined ? apiData.isSystem : obj.isSystem,
                    iconName: apiData.iconName || obj.iconName || '',
                    // Metadata
                    createdAt: apiData.createdAt || obj.createdAt || '',
                    updatedAt: apiData.updatedAt || obj.updatedAt || '',
                    createdBy: apiData.createdBy || obj.createdBy || '',
                    updatedBy: apiData.updatedBy || obj.updatedBy || '',
                    // Full API data
                    fullEnrichmentData: apiData
                };

                enrichedObjects.push(enrichedObject);
                console.log(`[Custom Object Enrichment] [${i + 1}] Enriched: ${enrichedObject.totalFields} fields, type: ${enrichedObject.type}`);
            } else {
                console.log(`[Custom Object Enrichment] [${i + 1}] No API data found, using snapshot data only`);
                enrichedObjects.push(obj);
            }
        }
    } catch (error) {
        console.error(`[Custom Object Enrichment] Error fetching custom object data:`, error);
        console.log('[Custom Object Enrichment] Returning snapshot data');
        return customObjects;
    }

    return enrichedObjects;
}

/**
 * Enrich dashboards with widget configurations and permissions
 */
async function enrichDashboards(dashboards, locationId) {
    if (!dashboards || dashboards.length === 0 || !locationId) {
        console.log('[Dashboard Enrichment] No dashboards to enrich or missing locationId');
        return dashboards;
    }

    console.log(`[Dashboard Enrichment] Enriching ${dashboards.length} dashboards`);
    const enrichedDashboards = [];

    try {
        // Fetch all dashboards from API
        const endpoint = `/reporting/dashboards?locationId=${locationId}`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);
        const apiDashboards = response.data?.dashboards || response.data || [];

        console.log(`[Dashboard Enrichment] Fetched ${apiDashboards.length} dashboards from API`);

        // Create a map for quick lookup
        const dashboardMap = new Map();
        apiDashboards.forEach(dashboard => {
            const dashboardId = dashboard.id || dashboard._id;
            if (dashboardId) {
                dashboardMap.set(dashboardId, dashboard);
            }
        });

        // Enrich each dashboard
        for (let i = 0; i < dashboards.length; i++) {
            const dashboard = dashboards[i];
            const dashboardId = dashboard.id || dashboard._id;
            const dashboardName = dashboard.name || 'Unnamed Dashboard';

            console.log(`[Dashboard Enrichment] [${i + 1}/${dashboards.length}] Processing: ${dashboardName}`);

            const apiData = dashboardMap.get(dashboardId);

            if (apiData && dashboardId) {
                // Try to fetch detailed information
                let dashboardDetails = null;
                let permissions = null;

                try {
                    // Fetch dashboard details
                    const detailsResponse = await window.ghlUtilsRevex.get(`/reporting/dashboards/${dashboardId}?locationId=${locationId}`);
                    dashboardDetails = detailsResponse.data || detailsResponse.data?.dashboard || null;
                    console.log(`[Dashboard Enrichment] [${i + 1}] Fetched details for ${dashboardName}`);
                } catch (error) {
                    console.log(`[Dashboard Enrichment] [${i + 1}] Could not fetch details: ${error.message}`);
                }

                try {
                    // Fetch dashboard permissions
                    const permResponse = await window.ghlUtilsRevex.get(`/reporting/dashboards/${dashboardId}/permissions?locationId=${locationId}`);
                    permissions = permResponse.data || permResponse.data?.permissions || null;
                    console.log(`[Dashboard Enrichment] [${i + 1}] Fetched permissions`);
                } catch (error) {
                    console.log(`[Dashboard Enrichment] [${i + 1}] Could not fetch permissions: ${error.message}`);
                }

                const enrichedDashboard = {
                    ...dashboard,
                    // Basic info
                    name: apiData.name || dashboard.name || '',
                    description: dashboardDetails?.description || apiData.description || dashboard.description || '',
                    // Widget information
                    totalWidgets: dashboardDetails?.widgets?.length || apiData.widgets?.length || 0,
                    widgetTypes: dashboardDetails?.widgets?.length > 0
                        ? [...new Set(dashboardDetails.widgets.map(w => w.type).filter(Boolean))].join('; ')
                        : '',
                    // Layout
                    layout: dashboardDetails?.layout || apiData.layout || dashboard.layout || '',
                    // Permissions
                    isShared: permissions?.isShared || false,
                    sharedWith: permissions?.users?.length || 0,
                    sharedWithTeams: permissions?.teams?.length || 0,
                    visibility: permissions?.visibility || apiData.visibility || 'private',
                    // Metadata
                    isDefault: apiData.isDefault || dashboard.isDefault || false,
                    createdBy: dashboardDetails?.createdBy || apiData.createdBy || dashboard.createdBy || '',
                    createdAt: apiData.createdAt || dashboard.createdAt || '',
                    updatedAt: dashboardDetails?.updatedAt || apiData.updatedAt || dashboard.updatedAt || '',
                    // Full API data
                    fullEnrichmentData: {
                        apiDashboard: apiData,
                        details: dashboardDetails,
                        permissions: permissions
                    }
                };

                enrichedDashboards.push(enrichedDashboard);
                console.log(`[Dashboard Enrichment] [${i + 1}] Enriched: ${enrichedDashboard.totalWidgets} widgets, visibility: ${enrichedDashboard.visibility}`);
            } else {
                console.log(`[Dashboard Enrichment] [${i + 1}] No API data found, using snapshot data only`);
                enrichedDashboards.push(dashboard);
            }

            // Add delay to avoid rate limiting
            if (i < dashboards.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
    } catch (error) {
        console.error(`[Dashboard Enrichment] Error fetching dashboard data:`, error);
        console.log('[Dashboard Enrichment] Returning snapshot data');
        return dashboards;
    }

    return enrichedDashboards;
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

    // Get all other keys (excluding priority columns and fullEnrichmentData)
    const allKeys = new Set();
    workflows.forEach(workflow => {
        Object.keys(workflow).forEach(key => {
            if (!priorityColumns.includes(key) && key !== 'fullEnrichmentData') {
                allKeys.add(key);
            }
        });
    });

    // Build final column order: priority columns + other columns + Full Enrichment Data
    const headers = [
        ...priorityColumns.map(col => columnNames[col] || col),
        ...Array.from(allKeys).sort(),
        'Full Enrichment Data'
    ];

    const fullColumnKeys = [...priorityColumns, ...Array.from(allKeys).sort(), 'fullEnrichmentData'];

    // Create data array starting with headers
    const dataArray = [headers];

    // Add data rows
    workflows.forEach(workflow => {
        const row = fullColumnKeys.map(key => {
            if (key === 'fullEnrichmentData') {
                // Return the full enrichment data as JSON string, truncated to Excel limit
                const jsonString = workflow.fullEnrichmentData ? JSON.stringify(workflow.fullEnrichmentData, null, 2) : '';
                return truncateToExcelLimit(jsonString);
            }
            const value = workflow[key];
            return formatValueForExcel(value);
        });
        dataArray.push(row);
    });

    return dataArray;
}
