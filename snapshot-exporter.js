/**
 * GHL Snapshot Export Documentation
 *
 * This module exports GHL snapshot assets to CSV format for documentation purposes.
 * It uses the revex-auth system to authenticate and fetch snapshot data from the
 * GHL backend API.
 *
 * Based on the workflow export implementation in GHL Utils
 */

// Module-level setting for including full enrichment data (JSON column)
let _includeFullEnrichmentData = true;

// Module-level setting for AI-friendly / plain export mode.
// When true: skip the 3-row header prepend (Back link, sheet metadata, blank)
// AND skip workbook styling (purple table headers, alternating rows, borders).
// Result: plain header row + raw data — easier for AI/scripts to parse.
let _aiFriendlyMode = false;

/**
 * Initialize export settings from chrome.storage
 */
async function initExportSettings() {
    const settings = await chrome.storage.local.get(['includeFullEnrichment', 'aiFriendlyMode']);
    _includeFullEnrichmentData = settings.includeFullEnrichment !== false; // Default to true
    _aiFriendlyMode = settings.aiFriendlyMode === true; // Default to false
}

/**
 * Main function to export snapshot assets
 * @param {string} snapshotId - The snapshot ID to export
 * @param {string} companyId - The company ID
 * @param {string} type - Type of assets to fetch (default: 'own')
 * @param {string} format - Export format: 'csv' or 'xlsx' (default: 'xlsx')
 * @param {Array<string>} selectedAssets - Array of asset type keys to export (default: all)
 */
async function exportSnapshotAssets(snapshotId, companyId, type = 'own', format = 'xlsx', selectedAssets = null) {
    try {
        // Initialize export settings
        await initExportSettings();

        // Ensure revex is ready
        if (!window.ghlUtilsRevex) {
            throw new Error('Revex authentication not available. Please reload the page.');
        }

        await window.ghlUtilsRevex.waitForReady();
        // Send progress update
        sendProgressUpdate(5, 'Fetching snapshot data...');

        // Fetch snapshot data with retry logic for 401 errors
        const endpoint = `/snapshots-appengine/snapshot/${snapshotId}/get_assets?type=${type}&companyId=${companyId}`;
        let response = null;
        let attempts = 0;
        const maxAttempts = 3;

        while (!response && attempts < maxAttempts) {
            attempts++;
            try {
                response = await window.ghlUtilsRevex.get(endpoint);
            } catch (error) {
                if (attempts < maxAttempts && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
                    sendProgressUpdate(5, `Retrying... (attempt ${attempts + 1}/${maxAttempts})`);
                    await new Promise(resolve => setTimeout(resolve, 3000));
                } else {
                    throw error;
                }
            }
        }

        const snapshotData = response.data;
        // Calculate and display estimated time
        const timeEstimate = estimateExportTime(snapshotData);
        sendProgressUpdate(30, `Processing snapshot assets... Estimated time: ${timeEstimate.formatted}`);

        if (format === 'xlsx') {
            // Export as single Excel workbook
            sendProgressUpdate(50, 'Creating Excel workbook...');
            const workbook = await convertSnapshotToExcel(snapshotData, snapshotId, companyId, selectedAssets);

            sendProgressUpdate(80, 'Generating Excel file...');
            downloadExcel(workbook, snapshotId);

            sendProgressUpdate(100, 'Export complete!');
            return { success: true, filesGenerated: 1, format: 'xlsx' };
        } else {
            // Export as multiple CSV files (original behavior)
            const csvFiles = await convertSnapshotToCSVs(snapshotData, snapshotId, selectedAssets);

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
            return { success: true, filesGenerated: csvFiles.length, format: 'csv' };
        }

    } catch (error) {
        sendProgressUpdate(0, `Error: ${error.message}`);
        throw error;
    }
}

/**
 * Export location assets directly (without snapshot reference)
 * @param {string} locationId - The location ID to export assets from
 * @param {string} format - Export format: 'csv' or 'xlsx' (default: 'xlsx')
 * @param {Array<string>} selectedAssets - Array of asset type keys to export (default: all)
 */
async function exportLocationAssets(locationId, format = 'xlsx+html', selectedAssets = null) {
    try {
        // Initialize export settings
        await initExportSettings();

        // Format string drives both the spreadsheet kind AND whether HTML
        // reports (Dashboard preview + Linkage map) are emitted. Recognized:
        //   'xlsx'        Excel + JSON
        //   'xlsx+html'   Excel + JSON + HTML reports (default)
        //   'csv'         CSVs + JSON
        //   'csv+html'    CSVs + JSON + HTML reports
        const includeHtml = String(format).indexOf('+html') !== -1;
        const baseFormat = String(format).replace('+html', '');

        // Ensure revex is ready
        if (!window.ghlUtilsRevex) {
            throw new Error('Revex authentication not available. Please reload the page.');
        }

        await window.ghlUtilsRevex.waitForReady();
        // Send progress update
        sendLocationProgressUpdate(5, 'Fetching location assets...');

        // Define asset type endpoints mapping
        const assetEndpoints = [
            { key: 'custom_fields', endpoint: `/locations/${locationId}/customFields`, dataKey: 'customFields' },
            { key: 'custom_values', endpoint: `/locations/${locationId}/customValues`, dataKey: 'customValues' },
            { key: 'tags', endpoint: `/locations/${locationId}/tags`, dataKey: 'tags' },
            { key: 'pipelines', endpoint: `/opportunities/pipelines?locationId=${locationId}`, dataKey: 'pipelines' },
            { key: 'calendars', endpoint: `/calendars/?locationId=${locationId}`, dataKey: 'calendars' },
            { key: 'campaigns', endpoint: `/campaigns/?locationId=${locationId}`, dataKey: 'campaigns' },
            { key: 'forms', endpoint: `/forms/?locationId=${locationId}`, dataKey: 'forms' },
            { key: 'surveys', endpoint: `/surveys/?locationId=${locationId}`, dataKey: 'surveys' },
            { key: 'workflow', endpoint: `/workflows/?locationId=${locationId}`, dataKey: 'workflows' },
            { key: 'funnels', endpoint: `/funnels/funnel/list?locationId=${locationId}&type=funnel&category=all&offset=0&limit=1000`, dataKey: 'funnels' },
            { key: 'triggers', endpoint: `/triggers/?locationId=${locationId}`, dataKey: 'triggers' },
            { key: 'email_templates', endpoint: `/emails/builder?locationId=${locationId}&limit=100&sortByDate=desc&archived=false&offset=0&templatesOnly=false`, dataKey: 'builders' },
            { key: 'folders', endpoint: `/medias/files/?altId=${locationId}&altType=location&parentId=&offset=0&limit=100&query=&type=folder&sortBy=updatedAt&sortOrder=desc&mode=public`, dataKey: 'files', baseUrl: 'services' },
            { key: 'media', endpoint: `/medias/files/?altId=${locationId}&altType=location&parentId=&offset=0&limit=100&query=&type=file&sortBy=updatedAt&sortOrder=desc&mode=public`, dataKey: 'files', baseUrl: 'services' },
            { key: 'knowledge_bases', endpoint: `/knowledge-base/all?locationId=${locationId}`, dataKey: 'knowledgeBases', baseUrl: 'services' },
            { key: 'voice_ai_agents', endpoint: `/voice-ai/agents/agents-with-folders?page=1&pageSize=50&query=&locationId=${locationId}&groupBy=foldersFirst&sortBy=lastUpdated`, dataKey: 'agents' },
            { key: 'ai_employees', endpoint: `/ai-employees/employees/dashboard/search?locationId=${locationId}&limit=100`, dataKey: 'employees', baseUrl: 'services' },
            { key: 'documents', endpoint: `/proposals/templates/bulk?type.in[]=proposal&type.in[]=estimate&locationId.eq=${locationId}&skip=0&limit=20`, dataKey: 'data' },
            { key: 'snippets', endpoint: `/snippets/${locationId}?skip=0&limit=100`, dataKey: 'snippets', baseUrl: 'services' },
            { key: 'objects', endpoint: `/objects/?locationId=${locationId}`, dataKey: 'objects', baseUrl: 'services' },
            { key: 'links', endpoint: `/links/search?locationId=${locationId}&skip=0&limit=1000`, dataKey: 'links', baseUrl: 'services' },
            { key: 'conversation_ai', endpoint: `/ai-employees/employees/dashboard/search?locationId=${locationId}&limit=20`, dataKey: 'employees', baseUrl: 'services' }
            // No endpoints yet for: text_templates, teams, membership_offers, membership_products,
            // quizzes, dashboards, custom_objects, certificates, review_settings, social_planner, sectionTemplates
        ];

        // Filter endpoints based on selected assets
        const endpointsToFetch = selectedAssets
            ? assetEndpoints.filter(ep => selectedAssets.includes(ep.key))
            : assetEndpoints;

        // Fetch all assets
        const locationData = {};
        let fetchedCount = 0;
        const totalToFetch = endpointsToFetch.length;

        for (const assetConfig of endpointsToFetch) {
            try {
                sendLocationProgressUpdate(
                    5 + Math.floor((fetchedCount / totalToFetch) * 40),
                    `Fetching ${assetConfig.key}...`
                );

                const response = await window.ghlUtilsRevex.get(assetConfig.endpoint, assetConfig.baseUrl || null);

                // Debug logging to troubleshoot response structure
                const responseKeys = response ? Object.keys(response) : [];
                const dataKeys = response?.data ? Object.keys(response.data) : [];
                if (response) {
                    // Handle different response structures - APIs return data in various formats
                    let assets = null;
                    let foundAt = 'not found';

                    // Try response.data[dataKey] first (most common from revex wrapper)
                    if (response.data && response.data[assetConfig.dataKey] && Array.isArray(response.data[assetConfig.dataKey])) {
                        assets = response.data[assetConfig.dataKey];
                        foundAt = `response.data.${assetConfig.dataKey}`;
                    }
                    // Try response.data.data[dataKey] (for APIs like knowledge-base that nest in data.data)
                    else if (response.data && response.data.data && response.data.data[assetConfig.dataKey] && Array.isArray(response.data.data[assetConfig.dataKey])) {
                        assets = response.data.data[assetConfig.dataKey];
                        foundAt = `response.data.data.${assetConfig.dataKey}`;
                    }
                    // Try response.data.data as array directly (for documents endpoint)
                    else if (response.data && response.data.data && Array.isArray(response.data.data)) {
                        assets = response.data.data;
                        foundAt = 'response.data.data (array)';
                    }
                    // Try response[dataKey] directly
                    else if (response[assetConfig.dataKey] && Array.isArray(response[assetConfig.dataKey])) {
                        assets = response[assetConfig.dataKey];
                        foundAt = `response.${assetConfig.dataKey}`;
                    }
                    // Try response.data as array
                    else if (response.data && Array.isArray(response.data)) {
                        assets = response.data;
                        foundAt = 'response.data (array)';
                    }
                    // Try response as array
                    else if (Array.isArray(response)) {
                        assets = response;
                        foundAt = 'response (array)';
                    }
                    // Fallback: search in response.data for arrays
                    else if (response.data && typeof response.data === 'object') {
                        // First check response.data.data for arrays
                        if (response.data.data && typeof response.data.data === 'object') {
                            for (const key of Object.keys(response.data.data)) {
                                if (Array.isArray(response.data.data[key])) {
                                    assets = response.data.data[key];
                                    foundAt = `response.data.data.${key} (auto-detected)`;
                                    break;
                                }
                            }
                        }
                        // Then check response.data for arrays
                        if (!assets) {
                            for (const key of Object.keys(response.data)) {
                                if (Array.isArray(response.data[key])) {
                                    assets = response.data[key];
                                    foundAt = `response.data.${key} (auto-detected)`;
                                    break;
                                }
                            }
                        }
                    }

                    if (!assets) {
                        assets = [];
                    }

                    // Ensure it's an array
                    if (!Array.isArray(assets)) {
                        if (assets && typeof assets === 'object') {
                            assets = Object.values(assets);
                        } else {
                            assets = [];
                        }
                    }

                    locationData[assetConfig.key] = assets;
                } else {
                    locationData[assetConfig.key] = [];
                }
            } catch (error) {
                locationData[assetConfig.key] = [];
            }
            fetchedCount++;
        }

        // Add empty arrays for asset types we couldn't fetch
        const allAssetKeys = [
            'custom_fields', 'custom_values', 'tags', 'pipelines', 'calendars',
            'campaigns', 'forms', 'surveys', 'workflow',
            'email_templates', 'funnels', 'links', 'folders', 'media',
            'triggers', 'knowledge_bases',
            'conversation_ai',
            'voice_ai_agents', 'ai_employees', 'documents', 'snippets', 'objects'
            // No endpoints yet: 'text_templates', 'teams', 'membership_offers', 'membership_products',
            // 'quizzes', 'dashboards', 'custom_objects', 'certificates',
            // 'review_settings', 'social_planner', 'sectionTemplates'
        ];

        for (const key of allAssetKeys) {
            if (!locationData[key]) {
                locationData[key] = [];
            }
        }

        sendLocationProgressUpdate(50, 'Processing location assets...');

        if (baseFormat === 'xlsx') {
            // Export as single Excel workbook + JSON (+ optional HTML reports).
            // JSON is generated and downloaded FIRST so it captures the full
            // untruncated enriched payload — Excel then applies its per-cell
            // 32,767-char limit only to the workbook it builds.
            sendLocationProgressUpdate(60, 'Creating export files...');
            const { workbook, jsonData } = await convertLocationToExcel(locationData, locationId, selectedAssets);

            sendLocationProgressUpdate(70, 'Generating JSON file...');
            downloadLocationJSON(jsonData, locationId);

            let extraHtmlFiles = 0;
            if (includeHtml) {
                sendLocationProgressUpdate(76, 'Building HTML dashboard...');
                const dashboardHtml = buildLocationDashboardHTML(locationId, jsonData);
                downloadLocationHTML(dashboardHtml, locationId, 'Dashboard');
                extraHtmlFiles++;

                sendLocationProgressUpdate(82, 'Building linkage map HTML...');
                const linkageHtml = buildLocationLinkageHTML(locationId, jsonData);
                downloadLocationHTML(linkageHtml, locationId, 'Linkages');
                extraHtmlFiles++;
            }

            sendLocationProgressUpdate(88, 'Generating Excel file...');
            downloadLocationExcel(workbook, locationId);

            sendLocationProgressUpdate(100, 'Export complete!');
            return { success: true, filesGenerated: 2 + extraHtmlFiles, format: includeHtml ? 'xlsx+json+html' : 'xlsx+json' };
        } else {
            // Export as multiple CSV files + JSON (+ optional HTML reports).
            // JSON is downloaded FIRST so a truncated CSV cell can never
            // silently leak into the JSON.
            sendLocationProgressUpdate(60, 'Creating export files...');
            const { jsonData } = await convertLocationToExcel(locationData, locationId, selectedAssets);

            sendLocationProgressUpdate(70, 'Generating JSON file...');
            downloadLocationJSON(jsonData, locationId);

            let extraHtmlFiles = 0;
            if (includeHtml) {
                sendLocationProgressUpdate(74, 'Building HTML dashboard...');
                const dashboardHtml = buildLocationDashboardHTML(locationId, jsonData);
                downloadLocationHTML(dashboardHtml, locationId, 'Dashboard');
                extraHtmlFiles++;

                sendLocationProgressUpdate(78, 'Building linkage map HTML...');
                const linkageHtml = buildLocationLinkageHTML(locationId, jsonData);
                downloadLocationHTML(linkageHtml, locationId, 'Linkages');
                extraHtmlFiles++;
            }

            const csvFiles = await convertLocationToCSVs(locationData, locationId, selectedAssets);

            sendLocationProgressUpdate(80, 'Generating CSV downloads...');

            // Download all CSV files
            for (let i = 0; i < csvFiles.length; i++) {
                const csvFile = csvFiles[i];
                downloadCSV(csvFile.content, csvFile.filename);
                await new Promise(resolve => setTimeout(resolve, 500));

                const progress = 80 + Math.floor((i + 1) / csvFiles.length * 18);
                sendLocationProgressUpdate(progress, `Downloading file ${i + 1} of ${csvFiles.length}...`);
            }

            sendLocationProgressUpdate(100, 'Export complete!');
            return { success: true, filesGenerated: csvFiles.length + 1 + extraHtmlFiles, format: includeHtml ? 'csv+json+html' : 'csv+json' };
        }

    } catch (error) {
        sendLocationProgressUpdate(0, `Error: ${error.message}`);
        throw error;
    }
}

/**
 * Send progress update for location export
 */
function sendLocationProgressUpdate(progress, message) {
    chrome.runtime.sendMessage({
        action: 'locationExportProgress',
        progress: progress,
        message: message
    });
}

/**
 * Compute cross-asset linkage from a finished export's enriched JSON data.
 * Mirrors the extraction logic used by the Dashboard preview's Graph view —
 * walks foreign keys, workflow templates, trigger conditions, form fields,
 * and merge tokens, returning {nodes, edges, outbound, inbound}.
 *
 * Source shape: same as jsonExportData (workflow, tags, custom_fields, etc.)
 */
function computeAssetLinkage(D) {
    const nodes = {};
    const byType = {};
    const edges = [];
    const outbound = {};
    const inbound = {};
    const tagByName = {};
    const cfByKey = {};
    const cvByKey = {};
    const seen = {};

    function asArr(v) {
        if (Array.isArray(v)) return v;
        if (v && typeof v === 'object' && Array.isArray(v.items)) return v.items;
        return [];
    }
    function addNode(collection, type, id, name, extra) {
        if (id == null || id === '') return null;
        const key = String(id);
        if (!nodes[key]) {
            nodes[key] = { id: key, type, collection, name: name || key, extra: extra || {} };
            if (!byType[type]) byType[type] = [];
            byType[type].push(key);
        }
        return key;
    }
    function addEdge(source, target, label, category) {
        if (!source || !target) return;
        const s = String(source), t = String(target);
        if (s === t) return;
        if (!nodes[s] || !nodes[t]) return;
        const k = s + '|' + t + '|' + label;
        if (seen[k]) return;
        seen[k] = 1;
        const e = { source: s, target: t, label, category };
        edges.push(e);
        (outbound[s] = outbound[s] || []).push(e);
        (inbound[t] = inbound[t] || []).push(e);
    }
    function asIdList(v) {
        if (!v) return [];
        if (Array.isArray(v)) return v.filter(Boolean).map(String);
        if (typeof v === 'string') return v.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
        return [];
    }
    function walkStrings(obj, visit) {
        if (obj == null) return;
        if (typeof obj === 'string') return visit(obj);
        if (Array.isArray(obj)) return obj.forEach(v => walkStrings(v, visit));
        if (typeof obj === 'object') return Object.values(obj).forEach(v => walkStrings(v, visit));
    }

    // Index nodes ----------------------------------------------------------
    asArr(D.custom_fields).forEach(f => {
        const id = addNode('custom_fields', 'custom_field', f.id || f._id, f.name);
        const fk = f.fullEnrichmentData && f.fullEnrichmentData.fieldKey;
        if (id && fk) cfByKey[String(fk).toLowerCase()] = id;
    });
    asArr(D.custom_values).forEach(v => {
        const id = addNode('custom_values', 'custom_value', v.id, v.name);
        const m = String(v.fieldKey || '').match(/custom_values\.([a-zA-Z0-9_]+)/);
        if (id && m) cvByKey['custom_values.' + m[1].toLowerCase()] = id;
    });
    asArr(D.tags).forEach(t => {
        const id = addNode('tags', 'tag', t.id, t.name);
        if (id && t.name) tagByName[String(t.name).toLowerCase().trim()] = id;
    });
    asArr(D.pipelines).forEach(p => addNode('pipelines', 'pipeline', p.id, p.name));
    asArr(D.pipeline_stages).forEach(s => addNode('pipeline_stages', 'pipeline_stage', s.stageId, s.stageName));
    asArr(D.calendars).forEach(c => addNode('calendars', 'calendar', c.id, c.name));
    asArr(D.calendar_groups).forEach(g => addNode('calendar_groups', 'calendar_group', g.id, g.name));
    asArr(D.forms).forEach(f => addNode('forms', 'form', f._id || f.id, f.name));
    asArr(D.surveys).forEach(s => addNode('surveys', 'survey', s._id || s.id, s.name));
    asArr(D.workflow).forEach(w => addNode('workflow', 'workflow', w.id, w.name));
    asArr(D.workflow_triggers).forEach(t => addNode('workflow_triggers', 'workflow_trigger', t.id, t.name));
    asArr(D.email_templates).forEach(e => addNode('email_templates', 'email_template', e.id, e.name));
    const fRoot = D.funnels || {};
    asArr(fRoot.funnels).forEach(f => addNode('funnels', 'funnel', f._id || f.id, f.name));
    asArr(fRoot.pages).forEach(p => addNode('funnels', 'funnel_page', p._id || p.id, p.name || p.pageName));
    asArr(fRoot.steps).forEach(s => addNode('funnels', 'funnel_step', s._id || s.id, s.name));
    asArr(D.folders).forEach(f => addNode('folders', 'folder', f._id || f.id, f.name));
    asArr(D.media).forEach(m => addNode('media', 'media', m._id || m.id, m.name));
    asArr(D.knowledge_bases).forEach(kb => addNode('knowledge_bases', 'knowledge_base', kb.id, kb.name));
    asArr(D.ai_employees).forEach(a => addNode('ai_employees', 'ai_employee', a.id, a.name));
    asArr(D.voice_ai_agents).forEach(a => addNode('voice_ai_agents', 'voice_ai_agent', a._id || a.id, a.agentName));
    asArr(D.conversation_ai).forEach(c => addNode('conversation_ai', 'conversation_ai', c.id, c.name));
    asArr(D.snippets).forEach(s => addNode('snippets', 'snippet', s.id, s.name));
    asArr(D.objects).forEach(o => addNode('objects', 'object', o.id, (o.labels && (o.labels.singular || o.labels.plural)) || o.key));
    asArr(D.links).forEach(l => addNode('links', 'link', l._id || l.id, l.name));

    // Hard foreign keys ----------------------------------------------------
    asArr(D.pipeline_stages).forEach(s => addEdge(s.stageId, s.pipelineId, 'belongs to pipeline', 'fk'));
    asArr(D.workflow_triggers).forEach(t => {
        if (t.workflowId) addEdge(t.id, t.workflowId, 'fires workflow', 'fk');
        const acts = (t.fullEnrichmentData && t.fullEnrichmentData.actions) || [];
        acts.forEach(a => { if (a.workflow_id) addEdge(t.id, a.workflow_id, 'action: ' + (a.type || 'add_to_workflow'), 'fk'); });
    });
    asArr(D.ai_employees).forEach(a => {
        asIdList(a.knowledgeBaseIds).forEach(kbId => addEdge(a.id, kbId, 'uses knowledge base', 'fk'));
        if (a.goalActionId && nodes[a.goalActionId]) addEdge(a.id, a.goalActionId, 'goal action', 'fk');
        asIdList(a.actionIds).forEach(id => { if (nodes[id]) addEdge(a.id, id, 'configured action', 'fk'); });
    });
    asArr(D.voice_ai_agents).forEach(a => {
        const id = a._id || a.id;
        if (a.appointmentCalendarId) addEdge(id, a.appointmentCalendarId, 'books appointments on', 'fk');
        asIdList(a.callEndWorkflowIds).forEach(wId => addEdge(id, wId, 'call-end workflow', 'fk'));
    });
    asArr(D.calendars).forEach(c => {
        if (c.groupId) addEdge(c.id, c.groupId, 'in calendar group', 'fk');
        if (c.formId) addEdge(c.id, c.formId, 'uses form', 'fk');
    });
    asArr(D.custom_fields).forEach(f => { if (f.parentId) addEdge(f.id || f._id, f.parentId, 'in custom-field folder', 'fk'); });
    asArr(D.folders).forEach(f => { if (f.parentId) addEdge(f._id || f.id, f.parentId, 'in parent folder', 'fk'); });
    asArr(D.media).forEach(m => { if (m.parentId) addEdge(m._id || m.id, m.parentId, 'in folder', 'fk'); });
    asArr(fRoot.pages).forEach(p => { const pid = p.funnelId || p.parentId; if (pid) addEdge(p._id || p.id, pid, 'belongs to funnel', 'fk'); });
    asArr(fRoot.steps).forEach(s => { const pid = s.funnelId || s.parentId; if (pid) addEdge(s._id || s.id, pid, 'belongs to funnel', 'fk'); });

    // Workflow step walk ---------------------------------------------------
    function scanTokens(wfId, text) {
        if (!text || typeof text !== 'string') return;
        const tokRe = /\{\{\s*(contact|custom_values)\.([a-zA-Z0-9_]+)\s*\}\}/g;
        let m;
        while ((m = tokRe.exec(text)) !== null) {
            const ns = m[1].toLowerCase();
            const keyLower = m[2].toLowerCase();
            if (ns === 'custom_values') {
                const cvId = cvByKey['custom_values.' + keyLower];
                if (cvId) addEdge(wfId, cvId, 'references custom value', 'token');
            } else {
                const cfId = cfByKey['contact.' + keyLower];
                if (cfId) addEdge(wfId, cfId, 'references custom field', 'token');
                if (nodes[m[2]] && nodes[m[2]].type === 'custom_field') addEdge(wfId, m[2], 'references custom field', 'token');
            }
        }
    }
    function scanStep(wfId, step) {
        const attrs = step.attributes || {};
        const stepName = step.name || step.type || 'step';
        switch (step.type) {
            case 'add_contact_tag':
            case 'remove_contact_tag':
                (attrs.tags || []).forEach(name => {
                    const tagId = tagByName[String(name).toLowerCase().trim()];
                    if (tagId) addEdge(wfId, tagId, (step.type === 'add_contact_tag' ? 'adds' : 'removes') + ' tag', 'action');
                });
                break;
            case 'create_opportunity':
            case 'internal_create_opportunity':
                if (attrs.pipeline_id) addEdge(wfId, attrs.pipeline_id, 'creates opportunity in pipeline', 'action');
                if (attrs.pipeline_stage_id) addEdge(wfId, attrs.pipeline_stage_id, 'creates opportunity at stage', 'action');
                break;
            case 'internal_update_opportunity':
                if (attrs.pipeline_id) addEdge(wfId, attrs.pipeline_id, 'updates opportunity pipeline', 'action');
                if (attrs.pipeline_stage_id) addEdge(wfId, attrs.pipeline_stage_id, 'moves to stage', 'action');
                break;
            case 'remove_opportunity':
                if (attrs.pipeline_id) addEdge(wfId, attrs.pipeline_id, 'removes opportunity from pipeline', 'action');
                break;
            case 'update_contact_field':
                (attrs.fields || []).forEach(f => { if (f.field) addEdge(wfId, f.field, 'updates custom field', 'action'); });
                break;
            case 'add_to_workflow':
                if (attrs.workflow_id) addEdge(wfId, Array.isArray(attrs.workflow_id) ? attrs.workflow_id[0] : attrs.workflow_id, 'add_to_workflow', 'action');
                break;
            case 'remove_from_workflow':
                if (attrs.workflow_id) addEdge(wfId, Array.isArray(attrs.workflow_id) ? attrs.workflow_id[0] : attrs.workflow_id, 'remove_from_workflow', 'action');
                break;
            case 'if_else':
                (attrs.branches || []).forEach(br => {
                    (br.segments || []).forEach(seg => {
                        (seg.conditions || []).forEach(c => {
                            if (c.conditionSubType === 'tags' && Array.isArray(c.conditionValue)) {
                                c.conditionValue.forEach(name => {
                                    const tid = tagByName[String(name).toLowerCase().trim()];
                                    if (tid) addEdge(wfId, tid, 'if/else branch matches tag', 'condition');
                                });
                            }
                            const fld = c.field || c.customFieldId || c.fieldId;
                            if (fld && nodes[fld] && nodes[fld].type === 'custom_field') {
                                addEdge(wfId, fld, 'if/else branch checks custom field', 'condition');
                            }
                        });
                    });
                });
                break;
        }
        walkStrings(attrs, s => scanTokens(wfId, s));
        // Generic ID fallback: any string in step attrs that is itself a node id
        walkStrings(attrs, s => {
            if (typeof s !== 'string') return;
            if (s.length < 12 || s.length > 48) return;
            if (!/^[A-Za-z0-9_-]+$/.test(s)) return;
            if (!nodes[s] || s === wfId) return;
            const tn = nodes[s];
            if (tn.type === 'tag' || tn.type === 'custom_field' || tn.type === 'custom_value') return;
            addEdge(wfId, s, tn.type + ' referenced in step', 'action');
        });
    }
    asArr(D.workflow).forEach(w => {
        const tmpl = (w.fullEnrichmentData && w.fullEnrichmentData.workflowData && w.fullEnrichmentData.workflowData.templates) || [];
        tmpl.forEach(step => scanStep(w.id, step));
    });

    // Trigger conditions ---------------------------------------------------
    asArr(D.workflow_triggers).forEach(t => {
        const conds = (t.fullEnrichmentData && (t.fullEnrichmentData.filters || t.fullEnrichmentData.conditions)) || [];
        walkStrings(conds, str => {
            const re = /(?:^|[^a-zA-Z0-9_])(contact|custom_values)\.([a-zA-Z0-9_]+)/g;
            let m;
            while ((m = re.exec(str)) !== null) {
                const ns = m[1].toLowerCase();
                const key = m[2];
                if (ns === 'custom_values') {
                    const cvId = cvByKey['custom_values.' + key.toLowerCase()];
                    if (cvId) addEdge(t.id, cvId, 'trigger references custom value', 'condition');
                } else {
                    const cfId = cfByKey['contact.' + key.toLowerCase()];
                    if (cfId) addEdge(t.id, cfId, 'trigger references custom field', 'condition');
                    if (nodes[key] && nodes[key].type === 'custom_field') addEdge(t.id, key, 'trigger references custom field', 'condition');
                }
            }
        });
        walkStrings(conds, str => {
            const v = String(str).toLowerCase().trim();
            if (tagByName[v]) addEdge(t.id, tagByName[v], 'trigger condition on tag', 'condition');
        });
    });

    // Form field tag → custom field ----------------------------------------
    asArr(D.forms).forEach(fm => {
        const fields = (fm.fullEnrichmentData && fm.fullEnrichmentData.formData && fm.fullEnrichmentData.formData.form && fm.fullEnrichmentData.formData.form.fields) || [];
        fields.forEach(fld => {
            if (fld && fld.tag && nodes[fld.tag] && nodes[fld.tag].type === 'custom_field') {
                addEdge(fm._id || fm.id, fld.tag, 'collects custom field', 'form_field');
            }
        });
    });

    // Survey + email template token scans ---------------------------------
    asArr(D.surveys).forEach(s => {
        const id = s._id || s.id;
        walkStrings(s.fullEnrichmentData || s, str => scanTokens(id, str));
    });
    asArr(D.email_templates).forEach(e => {
        walkStrings(e, str => scanTokens(e.id, str));
    });

    return { nodes, byType, edges, outbound, inbound };
}

/**
 * Build a per-asset map: id → "comma, separated, related, ids".
 * Combines inbound + outbound, deduplicates, preserves first-seen order
 * (outbound first, then inbound).
 */
function buildLinkageStringMap(linkage) {
    const out = {};
    for (const id in linkage.nodes) {
        const seen = new Set();
        const ordered = [];
        const outs = linkage.outbound[id] || [];
        const ins = linkage.inbound[id] || [];
        for (const e of outs) if (!seen.has(e.target)) { seen.add(e.target); ordered.push(e.target); }
        for (const e of ins) if (!seen.has(e.source)) { seen.add(e.source); ordered.push(e.source); }
        if (ordered.length) out[id] = ordered.join(', ');
    }
    return out;
}

/**
 * Mutate every asset in jsonExportData adding `relatedAssetName: "id1, id2, …"`
 * so the JSON export carries the linkage data alongside.
 */
function decorateAssetsWithLinkage(jsonExportData, linkageStringMap) {
    const collections = [
        jsonExportData.workflow,
        jsonExportData.workflow_triggers,
        jsonExportData.forms,
        jsonExportData.surveys,
        jsonExportData.calendars,
        jsonExportData.calendar_groups,
        jsonExportData.pipelines,
        jsonExportData.pipeline_stages,
        jsonExportData.email_templates,
        jsonExportData.tags,
        jsonExportData.custom_fields,
        jsonExportData.custom_values,
        jsonExportData.links,
        jsonExportData.folders,
        jsonExportData.media,
        jsonExportData.knowledge_bases,
        jsonExportData.conversation_ai,
        jsonExportData.voice_ai_agents,
        jsonExportData.ai_employees,
        jsonExportData.documents,
        jsonExportData.snippets,
        jsonExportData.objects,
        jsonExportData.triggers,
        jsonExportData.campaigns,
        jsonExportData.text_templates,
        (jsonExportData.funnels && jsonExportData.funnels.funnels),
        (jsonExportData.funnels && jsonExportData.funnels.pages),
        (jsonExportData.funnels && jsonExportData.funnels.steps),
    ];
    for (const list of collections) {
        if (!Array.isArray(list)) continue;
        for (const asset of list) {
            const id = asset && (asset._id || asset.id || asset.ID);
            if (!id) continue;
            const related = linkageStringMap[id];
            if (related) asset.relatedAssetName = related;
        }
    }
}

/**
 * Append a "RELATED ASSET NAME" column to every existing data sheet in
 * the workbook. Sheets are mapped by name to their underlying asset arrays
 * inside jsonExportData. Runs BEFORE addSheetHeader shifts rows.
 */
function injectLinkageIntoWorkbook(workbook, jsonExportData, linkageStringMap) {
    const f = jsonExportData.funnels || {};
    const sheetMap = [
        ['Workflows',              jsonExportData.workflow],
        ['Workflow_Triggers',      jsonExportData.workflow_triggers],
        ['Forms',                  jsonExportData.forms],
        ['Surveys',                jsonExportData.surveys],
        ['Funnels',                f.funnels],
        ['Funnel Pages',           f.pages],
        ['Funnel Steps',           f.steps],
        ['Calendars',              jsonExportData.calendars],
        ['Calendar Groups',        jsonExportData.calendar_groups],
        ['Pipelines',              jsonExportData.pipelines],
        ['Pipeline Stages',        jsonExportData.pipeline_stages],
        ['Email Templates',        jsonExportData.email_templates],
        ['Tags',                   jsonExportData.tags],
        ['Custom Fields',          jsonExportData.custom_fields],
        ['Custom Values',          jsonExportData.custom_values],
        ['Trigger_Links',          jsonExportData.links],
        ['Folders',                jsonExportData.folders],
        ['Media',                  jsonExportData.media],
        ['Knowledge Bases',        jsonExportData.knowledge_bases],
        ['Conversation AI',        jsonExportData.conversation_ai],
        ['Voice AI Agents',        jsonExportData.voice_ai_agents],
        ['AI Employees',           jsonExportData.ai_employees],
        ['Documents',              jsonExportData.documents],
        ['Snippets',               jsonExportData.snippets],
        ['Objects',                jsonExportData.objects],
        ['Triggers',               jsonExportData.triggers],
        ['Campaigns',              jsonExportData.campaigns],
        ['Text Templates',         jsonExportData.text_templates],
    ];
    for (const [sheetName, assets] of sheetMap) {
        if (!Array.isArray(assets) || !assets.length) continue;
        const sheet = workbook.Sheets[sheetName];
        if (!sheet || !sheet['!ref']) continue;
        appendRelatedAssetColumn(sheet, assets, linkageStringMap);
    }
}

function appendRelatedAssetColumn(sheet, assets, linkageStringMap) {
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const newCol = range.e.c + 1;

    // Header at row 0 (addSheetHeader hasn't shifted rows yet)
    sheet[XLSX.utils.encode_cell({ r: 0, c: newCol })] = { v: 'RELATED ASSET NAME', t: 's' };

    // Data rows: row i+1 corresponds to assets[i]
    for (let i = 0; i < assets.length; i++) {
        const a = assets[i];
        const id = a && (a._id || a.id || a.ID);
        const related = id ? linkageStringMap[id] : null;
        if (related) {
            sheet[XLSX.utils.encode_cell({ r: i + 1, c: newCol })] = { v: related, t: 's' };
        }
    }

    range.e.c = newCol;
    sheet['!ref'] = XLSX.utils.encode_range(range);

    if (Array.isArray(sheet['!cols'])) {
        sheet['!cols'].push({ wch: 60 });
    }
}

/**
 * Build the "Open in GHL" deep-link URL for a single asset.
 * Mirrors the link logic in the Dashboard HTML's TYPE_CONFIG so both surfaces
 * route to the same place. Returns null when no usable URL can be constructed.
 */
function buildGHLLinkForAsset(typeKey, item, locationId) {
    if (!locationId) return null;
    const v2 = 'https://app.gohighlevel.com/v2/location/' + locationId;
    const v1 = 'https://app.gohighlevel.com/location/' + locationId;
    const id = item && (item._id || item.id || item.ID);
    const name = item && item.name;

    switch (typeKey) {
        case 'custom_fields':
            return v2 + '/settings/fields';
        case 'custom_values':
            return name
                ? v2 + '/settings/custom_values?page=1&query=' + encodeURIComponent(name)
                : v2 + '/settings/custom_values';
        case 'tags':
            return name
                ? v2 + '/settings/tags?query=' + encodeURIComponent(name) + '&page=1'
                : v2 + '/settings/tags';
        case 'pipelines':
            return id ? v2 + '/opportunities/pipeline/' + id + '?tab=stages' : v2 + '/opportunities/pipeline';
        case 'pipeline_stages': {
            const pid = item && item.pipelineId;
            return pid ? v2 + '/opportunities/pipeline/' + pid + '?tab=stages' : null;
        }
        case 'calendars':
            return v2 + '/calendars/view';
        case 'calendar_groups':
            return v2 + '/settings/calendars';
        case 'calendar_configuration':
            return v2 + '/settings/calendars/connections';
        case 'forms':
            return id ? v2 + '/form-builder-v2/' + id : null;
        case 'surveys':
            return id ? v2 + '/survey-builder-v2/' + id : null;
        case 'workflow':
            return id ? v1 + '/workflow/' + id : null;
        case 'email_actions': {
            const wfid = item && item.workflowId;
            return wfid ? v1 + '/workflow/' + wfid : null;
        }
        case 'email_templates':
        case 'email_builder':
            return id ? v1 + '/emails/create/' + id + '/builder?pageNumber=1' : null;
        case 'snippets':
            return v2 + '/marketing/templates';
        case 'funnels':
            return id ? v2 + '/funnels-websites/funnels/' + id : null;
        case 'links':
            return v2 + '/marketing/trigger-links';
        case 'folders':
        case 'media':
            return v2 + '/media-storage';
        case 'knowledge_bases':
            return id ? v2 + '/ai-agents/knowledge-base/' + id : null;
        case 'voice_ai_agents':
            return id ? v2 + '/ai-agents/voice-ai/builder/' + id : null;
        case 'ai_employees':
        case 'conversation_ai':
            return id ? v2 + '/ai-agents/conversation-ai/agent/' + id : null;
        case 'objects':
        case 'custom_objects':
            return v2 + '/settings/objects';
        default:
            return null;
    }
}

function appendGHLLinkColumn(sheet, assets, typeKey, locationId) {
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const newCol = range.e.c + 1;

    sheet[XLSX.utils.encode_cell({ r: 0, c: newCol })] = { v: 'OPEN IN GHL', t: 's' };

    for (let i = 0; i < assets.length; i++) {
        const url = buildGHLLinkForAsset(typeKey, assets[i], locationId);
        if (url) {
            sheet[XLSX.utils.encode_cell({ r: i + 1, c: newCol })] = {
                v: 'Open in GHL ↗',
                t: 's',
                l: { Target: url, Tooltip: url }
            };
        }
    }

    range.e.c = newCol;
    sheet['!ref'] = XLSX.utils.encode_range(range);

    if (Array.isArray(sheet['!cols'])) {
        sheet['!cols'].push({ wch: 16 });
    }
}

function injectGHLLinksIntoWorkbook(workbook, jsonExportData, locationId) {
    const f = jsonExportData.funnels || {};
    const sheetMap = [
        ['Workflows',              jsonExportData.workflow,            'workflow'],
        ['Workflow_Triggers',      jsonExportData.workflow_triggers,   'workflow_triggers'],
        ['Forms',                  jsonExportData.forms,               'forms'],
        ['Surveys',                jsonExportData.surveys,             'surveys'],
        ['Funnels',                f.funnels,                          'funnels'],
        ['Funnel Pages',           f.pages,                            'funnel_pages'],
        ['Funnel Steps',           f.steps,                            'funnel_steps'],
        ['Calendars',              jsonExportData.calendars,           'calendars'],
        ['Calendar Groups',        jsonExportData.calendar_groups,     'calendar_groups'],
        ['Pipelines',              jsonExportData.pipelines,           'pipelines'],
        ['Pipeline Stages',        jsonExportData.pipeline_stages,     'pipeline_stages'],
        ['Email Templates',        jsonExportData.email_templates,     'email_templates'],
        ['Tags',                   jsonExportData.tags,                'tags'],
        ['Custom Fields',          jsonExportData.custom_fields,       'custom_fields'],
        ['Custom Values',          jsonExportData.custom_values,       'custom_values'],
        ['Trigger_Links',          jsonExportData.links,               'links'],
        ['Folders',                jsonExportData.folders,             'folders'],
        ['Media',                  jsonExportData.media,               'media'],
        ['Knowledge Bases',        jsonExportData.knowledge_bases,     'knowledge_bases'],
        ['Conversation AI',        jsonExportData.conversation_ai,     'conversation_ai'],
        ['Voice AI Agents',        jsonExportData.voice_ai_agents,     'voice_ai_agents'],
        ['AI Employees',           jsonExportData.ai_employees,        'ai_employees'],
        ['Snippets',               jsonExportData.snippets,            'snippets'],
        ['Objects',                jsonExportData.objects,             'objects'],
    ];
    for (const [sheetName, assets, typeKey] of sheetMap) {
        if (!Array.isArray(assets) || !assets.length) continue;
        const sheet = workbook.Sheets[sheetName];
        if (!sheet || !sheet['!ref']) continue;
        appendGHLLinkColumn(sheet, assets, typeKey, locationId);
    }
}

/**
 * Convert location data to Excel workbook
 */
async function convertLocationToExcel(locationData, locationId, selectedAssets = null) {
    // Collect enriched data for JSON export (full untruncated data)
    const jsonExportData = {
        _exportMetadata: {
            locationId: locationId,
            exportType: 'Live Location Assets',
            exportDate: new Date().toISOString(),
            format: 'JSON (full untruncated data)'
        }
    };

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
        // { key: 'text_templates', name: 'Text Templates' },  // No endpoint yet
        { key: 'email_templates', name: 'Email Templates' },
        { key: 'funnels', name: 'Funnels' },
        { key: 'links', name: 'Trigger Links' },
        { key: 'folders', name: 'Folders' },
        { key: 'media', name: 'Media' },
        // { key: 'teams', name: 'Teams' },  // No endpoint yet
        // { key: 'membership_offers', name: 'Membership Offers' },  // No endpoint yet
        // { key: 'membership_products', name: 'Membership Products' },  // No endpoint yet
        { key: 'triggers', name: 'Triggers' },
        { key: 'knowledge_bases', name: 'Knowledge Bases' },
        // { key: 'quizzes', name: 'Quizzes' },  // No endpoint yet
        // { key: 'dashboards', name: 'Dashboards' },  // No endpoint yet
        // { key: 'custom_objects', name: 'Custom Objects' },  // No endpoint yet
        // { key: 'certificates', name: 'Certificates' },  // No endpoint yet
        // { key: 'review_settings', name: 'Review Settings' },  // No endpoint yet
        { key: 'conversation_ai', name: 'Conversation AI' },
        // { key: 'social_planner', name: 'Social Planner' },  // No endpoint yet
        // { key: 'sectionTemplates', name: 'Section Templates' },  // No endpoint yet
        { key: 'voice_ai_agents', name: 'Voice AI Agents' },
        { key: 'ai_employees', name: 'AI Employees' },
        { key: 'documents', name: 'Documents' },
        { key: 'snippets', name: 'Snippets' },
        { key: 'objects', name: 'Objects' }
    ];

    // Filter asset types based on user selection
    const assetsToExport = selectedAssets
        ? assetTypes.filter(type => selectedAssets.includes(type.key))
        : assetTypes;

    // Capture export date for use in sheet headers
    const exportDate = new Date().toISOString();

    // Create summary data
    const summaryData = [];
    summaryData.push(['GHL Location Assets Export Summary']);
    summaryData.push(['Location ID', locationId]);
    summaryData.push(['Export Type', 'Live Location Assets']);
    summaryData.push(['Export Date', exportDate]);
    summaryData.push(['Export Format', 'Excel Workbook (.xlsx)']);
    summaryData.push([]);
    summaryData.push(['Asset Type', 'Count', 'Sheet Name']);

    // Create master list data
    const masterListData = [];
    masterListData.push(['ID', 'Name', 'Type of Asset']);

    let totalAssets = 0;
    let sheetsCreated = 0;

    // Pre-enrich workflows to build tag → workflow reverse map before processing tags
    const tagToWorkflowMap = new Map();
    let cachedEnrichedWorkflows = null;
    const workflowAssets = locationData['workflow'];
    if (workflowAssets && workflowAssets.length > 0) {
        const aiSettings = await chrome.storage.local.get(['aiAnalysisEnabled', 'openaiApiKey']);
        const aiEnabled = aiSettings.aiAnalysisEnabled === true && aiSettings.openaiApiKey;
        const progressMsg = aiEnabled
            ? `Analyzing ${workflowAssets.length} workflows with AI...`
            : `Enriching ${workflowAssets.length} workflows...`;
        sendLocationProgressUpdate(55, progressMsg);

        cachedEnrichedWorkflows = await enrichWorkflowsWithAI(workflowAssets, null, null, locationId);

        // Build tag → workflow name reverse map
        cachedEnrichedWorkflows.forEach(wf => {
            const wfName = wf.name || 'Unnamed Workflow';
            const tagsUsed = wf.tagsUsed || '';
            if (tagsUsed) {
                tagsUsed.split('; ').forEach(tagName => {
                    if (!tagToWorkflowMap.has(tagName)) {
                        tagToWorkflowMap.set(tagName, []);
                    }
                    tagToWorkflowMap.get(tagName).push(wfName);
                });
            }
        });
    }

    // Count tag usage across contacts (drives tags.contactCount). The tags API
    // endpoint does not return usage counts, so we derive them by querying
    // /contacts/search/2 once per tag and reading `total`.
    let tagContactCountMap = new Map();
    const willExportTags = assetsToExport.some(t => t.key === 'tags')
        && (locationData['tags'] || []).length > 0;
    if (willExportTags) {
        const tagNames = (locationData['tags'] || []).map(t => t && t.name).filter(Boolean);
        sendLocationProgressUpdate(56, `Counting contacts for ${tagNames.length} tags...`);
        tagContactCountMap = await fetchContactsAndCountTags(locationId, tagNames, (done, total) => {
            sendLocationProgressUpdate(56, `Counting contacts per tag (${done}/${total})...`);
        });
    }

    // Defer trigger links so we can populate reverse-lookup columns from
    // every other enriched asset. Processed after the main loop.
    let deferredLinkAssets = null;

    // Process each asset type
    for (const assetType of assetsToExport) {
        const assets = locationData[assetType.key];

        if (assets && assets.length > 0) {
            // Custom fields have special handling that replaces the asset list entirely,
            // so skip the generic summary/master list addition for them
            const hasSpecialMasterListHandling = assetType.key === 'custom_fields';

            if (!hasSpecialMasterListHandling) {
                totalAssets += assets.length;

                // Add to summary
                summaryData.push([assetType.name, assets.length, assetType.name]);

                // Add each asset to master list
                assets.forEach(asset => {
                    const id = asset._id || asset.id || asset.ID || '';
                    const name = asset.name || asset.title || asset.Name || '';
                    masterListData.push([id, name, assetType.name]);
                });
            }

            // Special handling for workflows - use pre-enriched data from above
            if (assetType.key === 'workflow') {
                const enrichedWorkflows = cachedEnrichedWorkflows || assets;

                // Collect every send_email step across all workflows, fetch
                // its triggers + resolve any snippet reference, then mutate
                // the workflow templates in place so the workflow JSON also
                // carries `_snippetContent` / `_triggers` per email step.
                sendLocationProgressUpdate(56, `Fetching email snippets...`);
                const snippetMap = await fetchEmailSnippets(locationId);
                sendLocationProgressUpdate(57, `Collating email actions across ${enrichedWorkflows.length} workflows...`);
                const emailActions = await collectEmailActionsFromWorkflows(
                    enrichedWorkflows,
                    locationId,
                    snippetMap,
                    (done, totalSteps) => {
                        const label = totalSteps
                            ? `Fetching email triggers (${done}/${totalSteps})...`
                            : `Fetching email triggers (${done})...`;
                        sendLocationProgressUpdate(57, label);
                    }
                );

                jsonExportData['workflow'] = enrichedWorkflows;

                const sheetData = convertWorkflowsToArray(enrichedWorkflows);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                // Set custom column widths for workflows
                worksheet['!cols'] = [
                    { wch: 35 }, { wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 15 },
                    { wch: 15 }, { wch: 40 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
                    { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 12 },
                    { wch: 40 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 12 },
                    { wch: 60 }, { wch: 12 }, { wch: 60 }, { wch: 12 }, { wch: 12 },
                    { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 60 }, { wch: 60 }
                ];

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Workflows');
                sheetsCreated++;
                // Fetch and create Workflow Triggers sheet
                sendLocationProgressUpdate(56, `Fetching triggers for ${assets.length} workflows...`);
                const workflowTriggers = await fetchWorkflowTriggers(assets, locationId);

                if (workflowTriggers.length > 0) {
                    jsonExportData['workflow_triggers'] = workflowTriggers;
                    const triggerSheetData = convertAssetTypeToArray(workflowTriggers);
                    const triggerWorksheet = XLSX.utils.aoa_to_sheet(triggerSheetData);
                    triggerWorksheet['!cols'] = triggerSheetData[0].map(() => ({ wch: 20 }));
                    XLSX.utils.book_append_sheet(workbook, triggerWorksheet, 'Workflow_Triggers');
                    sheetsCreated++;
                }

                // Email Actions sheet — one row per email step, with snippet
                // content + trigger config side-by-side with its workflow.
                if (emailActions.length > 0) {
                    jsonExportData['email_actions'] = emailActions;
                    const emailActionsSheetData = convertAssetTypeToArray(emailActions);
                    const emailActionsWorksheet = XLSX.utils.aoa_to_sheet(emailActionsSheetData);
                    emailActionsWorksheet['!cols'] = emailActionsSheetData[0].map(() => ({ wch: 25 }));
                    XLSX.utils.book_append_sheet(workbook, emailActionsWorksheet, 'Email Actions');
                    sheetsCreated++;
                }
            }
            // Special handling for Forms - enrich with full data
            else if (assetType.key === 'forms') {
                sendLocationProgressUpdate(58, `Enriching ${assets.length} forms...`);

                const enrichedForms = await enrichForms(assets, locationId);
                jsonExportData['forms'] = enrichedForms;
                const sheetData = convertAssetTypeToArray(enrichedForms);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
                worksheet['!cols'] = sheetData[0].map(() => ({ wch: 20 }));

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Forms');
                sheetsCreated++;
            }
            // Special handling for Funnels - enrich with pages, steps, elements
            else if (assetType.key === 'funnels') {
                sendLocationProgressUpdate(60, `Enriching ${assets.length} funnels...`);

                const { enrichedFunnels, allPages, allSteps, allElementCounts } = await enrichFunnels(assets, locationId);
                jsonExportData['funnels'] = { funnels: enrichedFunnels, pages: allPages, steps: allSteps, elementCounts: allElementCounts };

                // Create main Funnels sheet
                const sheetData = convertAssetTypeToArray(enrichedFunnels);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
                worksheet['!cols'] = sheetData[0].map(() => ({ wch: 20 }));
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Funnels');
                sheetsCreated++;

                // Create Funnel Pages sheet
                if (allPages.length > 0) {
                    const pagesSheetData = convertAssetTypeToArray(allPages);
                    const pagesWorksheet = XLSX.utils.aoa_to_sheet(pagesSheetData);
                    pagesWorksheet['!cols'] = pagesSheetData[0].map(() => ({ wch: 20 }));
                    XLSX.utils.book_append_sheet(workbook, pagesWorksheet, 'Funnel Pages');
                    sheetsCreated++;
                }

                // Create Funnel Steps sheet
                if (allSteps.length > 0) {
                    const stepsSheetData = convertAssetTypeToArray(allSteps);
                    const stepsWorksheet = XLSX.utils.aoa_to_sheet(stepsSheetData);
                    stepsWorksheet['!cols'] = stepsSheetData[0].map(() => ({ wch: 20 }));
                    XLSX.utils.book_append_sheet(workbook, stepsWorksheet, 'Funnel Steps');
                    sheetsCreated++;
                }

                // Create Funnel Page Elements sheet
                if (allElementCounts.length > 0) {
                    const elementsSheetData = convertAssetTypeToArray(allElementCounts);
                    const elementsWorksheet = XLSX.utils.aoa_to_sheet(elementsSheetData);
                    elementsWorksheet['!cols'] = elementsSheetData[0].map(() => ({ wch: 15 }));
                    XLSX.utils.book_append_sheet(workbook, elementsWorksheet, 'Funnel Page Elements');
                    sheetsCreated++;
                }
            }
            // Special handling for Calendars - enrich with full data
            else if (assetType.key === 'calendars') {
                sendLocationProgressUpdate(65, `Enriching ${assets.length} calendars...`);

                const enrichedCalendars = await enrichCalendars(assets, locationId);
                jsonExportData['calendars'] = enrichedCalendars;
                const sheetData = convertAssetTypeToArray(enrichedCalendars);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
                worksheet['!cols'] = sheetData[0].map(() => ({ wch: 20 }));

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Calendars');
                sheetsCreated++;

                // Also create Calendar Configuration sheet
                const calendarConfig = await extractCalendarConfiguration(locationId);
                if (calendarConfig) {
                    jsonExportData['calendar_configuration'] = calendarConfig;
                    const configSheetData = convertAssetTypeToArray([calendarConfig]);
                    const configWorksheet = XLSX.utils.aoa_to_sheet(configSheetData);
                    configWorksheet['!cols'] = configSheetData[0].map(() => ({ wch: 20 }));
                    XLSX.utils.book_append_sheet(workbook, configWorksheet, 'Calendar Configuration');
                    sheetsCreated++;
                }

                // Also create Calendar Groups sheet
                const calendarGroups = await enrichCalendarGroups(locationId);
                if (calendarGroups && calendarGroups.length > 0) {
                    jsonExportData['calendar_groups'] = calendarGroups;
                    const groupsSheetData = convertAssetTypeToArray(calendarGroups);
                    const groupsWorksheet = XLSX.utils.aoa_to_sheet(groupsSheetData);
                    groupsWorksheet['!cols'] = groupsSheetData[0].map(() => ({ wch: 20 }));
                    XLSX.utils.book_append_sheet(workbook, groupsWorksheet, 'Calendar Groups');
                    sheetsCreated++;
                }
            }
            // Special handling for Pipelines - enrich with full data
            else if (assetType.key === 'pipelines') {
                sendLocationProgressUpdate(70, `Enriching ${assets.length} pipelines...`);

                const enrichedPipelines = await enrichPipelines(assets, locationId);
                jsonExportData['pipelines'] = enrichedPipelines;
                const sheetData = convertAssetTypeToArray(enrichedPipelines);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
                worksheet['!cols'] = sheetData[0].map(() => ({ wch: 20 }));

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Pipelines');
                sheetsCreated++;

                // Also create Pipeline Stages sheet
                const pipelineStages = extractPipelineStages(enrichedPipelines);
                if (pipelineStages && pipelineStages.length > 0) {
                    jsonExportData['pipeline_stages'] = pipelineStages;
                    const stagesSheetData = convertAssetTypeToArray(pipelineStages);
                    const stagesWorksheet = XLSX.utils.aoa_to_sheet(stagesSheetData);
                    stagesWorksheet['!cols'] = stagesSheetData[0].map(() => ({ wch: 20 }));
                    XLSX.utils.book_append_sheet(workbook, stagesWorksheet, 'Pipeline Stages');
                    sheetsCreated++;
                }
            }
            // Special handling for Email Templates - enrich with full data
            else if (assetType.key === 'email_templates') {
                sendLocationProgressUpdate(75, `Enriching ${assets.length} email templates...`);

                const enrichedTemplates = await enrichEmailTemplates(assets, locationId);
                jsonExportData['email_templates'] = enrichedTemplates;
                const sheetData = convertAssetTypeToArray(enrichedTemplates);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
                worksheet['!cols'] = sheetData[0].map(() => ({ wch: 20 }));

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Email Templates');
                sheetsCreated++;
            }
            // Special handling for Quizzes - enrich like forms
            else if (assetType.key === 'quizzes') {
                sendLocationProgressUpdate(78, `Enriching ${assets.length} quizzes...`);

                const enrichedQuizzes = await enrichForms(assets, locationId);
                jsonExportData['quizzes'] = enrichedQuizzes;
                const sheetData = convertAssetTypeToArray(enrichedQuizzes);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
                worksheet['!cols'] = sheetData[0].map(() => ({ wch: 20 }));

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Quizzes');
                sheetsCreated++;
            }
            // Special handling for Custom Fields - fetch ALL custom fields including opportunity and custom object fields
            else if (assetType.key === 'custom_fields') {
                sendLocationProgressUpdate(79, `Fetching all custom fields (contacts, opportunities, custom objects)...`);

                const allCustomFields = await fetchAllCustomFieldsForLocation(locationId);
                jsonExportData['custom_fields'] = allCustomFields;
                const sheetData = convertAssetTypeToArray(allCustomFields);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
                worksheet['!cols'] = sheetData[0].map(() => ({ wch: 20 }));

                // Add summary and master list entries for the enriched custom fields
                totalAssets += allCustomFields.length;
                summaryData.push([assetType.name, allCustomFields.length, assetType.name]);

                allCustomFields.forEach(field => {
                    const id = field._id || field.id || '';
                    const name = field.name || '';
                    masterListData.push([id, name, 'Custom Fields']);
                });

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Custom_Fields');
                sheetsCreated++;
            }
            // Special handling for Voice AI Agents - enrich with full configuration
            else if (assetType.key === 'voice_ai_agents') {
                sendLocationProgressUpdate(80, `Enriching ${assets.length} Voice AI agents...`);

                const enrichedAgents = await enrichVoiceAIAgents(assets, locationId);
                jsonExportData['voice_ai_agents'] = enrichedAgents;
                const sheetData = convertAssetTypeToArray(enrichedAgents);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
                worksheet['!cols'] = sheetData[0].map(() => ({ wch: 20 }));

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Voice_AI_Agents');
                sheetsCreated++;
            }
            // Special handling for AI Employees - enrich with full configuration
            else if (assetType.key === 'ai_employees') {
                sendLocationProgressUpdate(80, `Enriching ${assets.length} AI employees...`);

                const enrichedEmployees = await enrichAIEmployees(assets, locationId);
                jsonExportData['ai_employees'] = enrichedEmployees;
                const sheetData = convertAssetTypeToArray(enrichedEmployees);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
                worksheet['!cols'] = sheetData[0].map(() => ({ wch: 20 }));

                XLSX.utils.book_append_sheet(workbook, worksheet, 'AI_Employees');
                sheetsCreated++;
            }
            // Special handling for Knowledge Bases - enrich with files, URLs, FAQs
            else if (assetType.key === 'knowledge_bases') {
                sendLocationProgressUpdate(81, `Enriching ${assets.length} knowledge bases...`);

                const enrichedKBs = await enrichKnowledgeBases(assets, locationId);
                jsonExportData['knowledge_bases'] = enrichedKBs;
                const sheetData = convertAssetTypeToArray(enrichedKBs);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
                worksheet['!cols'] = sheetData[0].map(() => ({ wch: 20 }));

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Knowledge_Bases');
                sheetsCreated++;
            }
            // Special handling for Documents - enrich with template details
            else if (assetType.key === 'documents') {
                sendLocationProgressUpdate(82, `Enriching ${assets.length} documents...`);

                const enrichedDocs = await enrichDocuments(assets, locationId);
                jsonExportData['documents'] = enrichedDocs;
                const sheetData = convertAssetTypeToArray(enrichedDocs);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
                worksheet['!cols'] = sheetData[0].map(() => ({ wch: 20 }));

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Documents');
                sheetsCreated++;
            }
            // Special handling for Snippets - enrich with template details
            else if (assetType.key === 'snippets') {
                sendLocationProgressUpdate(83, `Enriching ${assets.length} snippets...`);

                const enrichedSnippets = await enrichSnippets(assets, locationId);
                jsonExportData['snippets'] = enrichedSnippets;
                const sheetData = convertAssetTypeToArray(enrichedSnippets);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
                worksheet['!cols'] = sheetData[0].map(() => ({ wch: 20 }));

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Snippets');
                sheetsCreated++;
            }
            // Special handling for Links - deferred to after the loop so we can
            // cross-reference every other enriched asset (forms, workflows, etc.)
            else if (assetType.key === 'links') {
                deferredLinkAssets = assets;
            }
            // Special handling for Custom Values - enrich with folder organization
            else if (assetType.key === 'custom_values') {
                sendLocationProgressUpdate(84, `Enriching ${assets.length} custom values...`);

                const enrichedValues = await enrichCustomValues(assets, locationId);
                jsonExportData['custom_values'] = enrichedValues;
                const sheetData = convertAssetTypeToArray(enrichedValues);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
                worksheet['!cols'] = sheetData[0].map(() => ({ wch: 20 }));

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Custom_Values');
                sheetsCreated++;
            }
            // Special handling for Tags - enrich with usage statistics and workflow reverse map
            else if (assetType.key === 'tags') {
                sendLocationProgressUpdate(85, `Enriching ${assets.length} tags...`);

                const enrichedTags = await enrichTags(assets, locationId, tagToWorkflowMap, tagContactCountMap);
                jsonExportData['tags'] = enrichedTags;
                const sheetData = convertAssetTypeToArray(enrichedTags);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
                worksheet['!cols'] = sheetData[0].map(() => ({ wch: 20 }));

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Tags');
                sheetsCreated++;
            }
            // Default handling for other asset types
            else {
                jsonExportData[assetType.key] = assets;
                const sheetData = convertAssetTypeToArray(assets);
                const ws = XLSX.utils.aoa_to_sheet(sheetData);

                // Set column widths
                const colWidths = sheetData[0].map((_, i) => ({
                    wch: Math.min(
                        Math.max(
                            ...sheetData.slice(0, 100).map(row => String(row[i] || '').length),
                            10
                        ),
                        50
                    )
                }));
                ws['!cols'] = colWidths;

                // Truncate sheet name to 31 chars (Excel limit)
                const sheetName = assetType.name.substring(0, 31);
                XLSX.utils.book_append_sheet(workbook, ws, sheetName);
                sheetsCreated++;

            }
        }
    }

    // Process deferred Trigger Links last so reverse-lookup columns can reference
    // every other enriched asset collected in jsonExportData.
    if (deferredLinkAssets && deferredLinkAssets.length > 0) {
        sendLocationProgressUpdate(88, `Enriching ${deferredLinkAssets.length} trigger links...`);
        const enrichedLinksBase = await enrichLinks(deferredLinkAssets, locationId);
        const enrichedLinks = addTriggerLinkReverseLookup(enrichedLinksBase, jsonExportData);
        jsonExportData['links'] = enrichedLinks;
        const sheetData = convertAssetTypeToArray(enrichedLinks);
        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
        worksheet['!cols'] = sheetData[0].map(() => ({ wch: 20 }));
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Trigger_Links');
        sheetsCreated++;
    }

    // Compute cross-asset linkage and decorate every sheet + JSON record
    // with a "Related Asset Name" column / field (comma-separated IDs).
    try {
        sendLocationProgressUpdate(89, 'Computing asset linkage...');
        const linkage = computeAssetLinkage(jsonExportData);
        const linkageStringMap = buildLinkageStringMap(linkage);
        decorateAssetsWithLinkage(jsonExportData, linkageStringMap);
        injectLinkageIntoWorkbook(workbook, jsonExportData, linkageStringMap);
        jsonExportData._exportMetadata.linkageEdgeCount = linkage.edges.length;
    } catch (linkageErr) {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn('Linkage decoration failed:', linkageErr);
        }
    }

    // Add a clickable "Open in GHL" column to every asset sheet, except in
    // AI-friendly mode where users want plain unstyled data for parsing.
    if (!_aiFriendlyMode) {
        try {
            injectGHLLinksIntoWorkbook(workbook, jsonExportData, locationId);
        } catch (ghlLinkErr) {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('GHL link injection failed:', ghlLinkErr);
            }
        }
    }

    // Add summary to summary data
    summaryData.push([]);
    summaryData.push(['Total Assets', totalAssets]);
    summaryData.push(['Sheets Created', sheetsCreated]);

    // Create summary sheet (prepend it to the workbook)
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 40 }, { wch: 40 }, { wch: 25 }];

    // Add hyperlinks from Summary "Sheet Name" column to each data sheet
    // Data rows start after: title, locationId, exportType, exportDate, exportFormat, blank, header = row 7
    const summaryDataStartRow = 7;
    for (let i = summaryDataStartRow; i < summaryData.length; i++) {
        const sheetLabel = summaryData[i][2]; // Sheet Name column
        if (!sheetLabel || sheetLabel === 'N/A') continue;
        const targetSheet = workbook.SheetNames.find(s =>
            s === sheetLabel || s === sheetLabel.replace(/ /g, '_')
        );
        if (!targetSheet) continue;
        const cellRef = XLSX.utils.encode_cell({ r: i, c: 2 });
        if (summaryWs[cellRef]) {
            summaryWs[cellRef].l = { Target: `#'${targetSheet}'!A1` };
        }
    }

    // Create master list sheet
    const masterWs = XLSX.utils.aoa_to_sheet(masterListData);
    masterWs['!cols'] = [{ wch: 30 }, { wch: 50 }, { wch: 20 }];

    // Add hyperlinks to master list columns
    // Track per-sheet row counters so ID links point to the correct row
    const sheetRowCounters = {};
    for (let row = 1; row < masterListData.length; row++) {
        const assetTypeName = masterListData[row][2];
        if (!assetTypeName) continue;

        // Find the matching sheet name (may use underscores instead of spaces)
        const sheetName = workbook.SheetNames.find(s =>
            s === assetTypeName || s === assetTypeName.replace(/ /g, '_')
        );
        if (!sheetName) continue;

        // Track row counter per sheet (row 0 is header, data starts at row 1)
        if (!sheetRowCounters[sheetName]) sheetRowCounters[sheetName] = 1;
        const sheetRow = sheetRowCounters[sheetName]++;

        // Add hyperlink to "Type of Asset" column (column C) → sheet tab
        const typeCellRef = XLSX.utils.encode_cell({ r: row, c: 2 });
        if (masterWs[typeCellRef]) {
            masterWs[typeCellRef].l = { Target: `#'${sheetName}'!A1` };
        }

        // Add hyperlink to "ID" column (column A) → specific row in sheet
        // +3 offset accounts for the 3 header rows added to each sheet
        const idCellRef = XLSX.utils.encode_cell({ r: row, c: 0 });
        if (masterWs[idCellRef]) {
            masterWs[idCellRef].l = { Target: `#'${sheetName}'!A${sheetRow + 1 + 3}` };
        }

        // Add hyperlink to "Name" column (column B) → specific row in sheet
        const nameCellRef = XLSX.utils.encode_cell({ r: row, c: 1 });
        if (masterWs[nameCellRef]) {
            masterWs[nameCellRef].l = { Target: `#'${sheetName}'!A${sheetRow + 1 + 3}` };
        }
    }

    // Prepend summary and master list sheets
    const tempWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(tempWorkbook, summaryWs, 'Summary');
    XLSX.utils.book_append_sheet(tempWorkbook, masterWs, 'Master List');

    // Copy all existing sheets. In AI-friendly mode, skip the 3-row sheet header
    // prepend so each sheet starts directly with its column header row.
    workbook.SheetNames.forEach(name => {
        if (!_aiFriendlyMode) {
            addSheetHeader(workbook.Sheets[name], name, exportDate);
        }
        XLSX.utils.book_append_sheet(tempWorkbook, workbook.Sheets[name], name);
    });

    // Add summary info to JSON export
    jsonExportData._exportMetadata.totalAssets = totalAssets;
    jsonExportData._exportMetadata.sheetsCreated = sheetsCreated;
    jsonExportData._exportMetadata.aiFriendlyMode = _aiFriendlyMode;

    // Apply professional styling to the entire workbook (skipped in AI-friendly mode)
    if (!_aiFriendlyMode) {
        applyWorkbookStyles(tempWorkbook);
    }

    return { workbook: tempWorkbook, jsonData: jsonExportData };
}

/**
 * Convert location data to multiple CSV files
 */
async function convertLocationToCSVs(locationData, locationId, selectedAssets = null) {
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
        { key: 'media', name: 'Media' },
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
        { key: 'sectionTemplates', name: 'Section_Templates' },
        { key: 'voice_ai_agents', name: 'Voice_AI_Agents' },
        { key: 'ai_employees', name: 'AI_Employees' },
        { key: 'documents', name: 'Documents' },
        { key: 'snippets', name: 'Snippets' },
        { key: 'objects', name: 'Objects' }
    ];

    // Filter asset types based on user selection
    const assetsToExport = selectedAssets
        ? assetTypes.filter(type => selectedAssets.includes(type.key))
        : assetTypes;

    // Process each asset type
    for (const assetType of assetsToExport) {
        let assets = locationData[assetType.key];

        // Special handling for custom_fields - fetch ALL custom fields including opportunity and custom objects
        if (assetType.key === 'custom_fields' && locationId) {
            assets = await fetchAllCustomFieldsForLocation(locationId);
        }

        if (assets && assets.length > 0) {
            const csv = convertAssetTypeToCSV(assets);
            const filename = `Location_${locationId}_${assetType.name}_${timestamp}.csv`;

            csvFiles.push({
                filename: filename,
                content: csv,
                assetType: assetType.name,
                count: assets.length
            });

        }
    }

    // Create a summary CSV
    const summaryCSV = createLocationSummaryCSV(csvFiles, locationId);
    csvFiles.unshift({
        filename: `Location_${locationId}_SUMMARY_${timestamp}.csv`,
        content: summaryCSV,
        assetType: 'Summary',
        count: csvFiles.length
    });

    return csvFiles;
}

/**
 * Create summary CSV for location export
 */
function createLocationSummaryCSV(csvFiles, locationId) {
    let csv = 'GHL Location Assets Export Summary\n\n';
    csv += 'Location ID,' + escapeCSVValue(locationId) + '\n';
    csv += 'Export Type,Live Location Assets\n';
    csv += 'Export Date,' + new Date().toISOString() + '\n\n';
    csv += 'Asset Type,Count,Filename\n';

    for (const file of csvFiles) {
        if (file.assetType !== 'Summary') {
            csv += `${file.assetType},${file.count},${file.filename}\n`;
        }
    }

    const totalAssets = csvFiles.reduce((sum, f) => f.assetType !== 'Summary' ? sum + f.count : sum, 0);
    csv += `\nTotal Assets,${totalAssets}\n`;
    csv += `Files Generated,${csvFiles.length}\n`;

    return csv;
}

/**
 * Download Excel file for location export
 */
function downloadLocationExcel(workbook, locationId) {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `Location_${locationId}_Assets_${timestamp}.xlsx`;

    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

}

/**
 * Download JSON file with full untruncated data
 * @param {Object} data - The data to export as JSON
 * @param {string} locationId - The location ID for the filename
 */
function downloadLocationJSON(data, locationId) {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `Location_${locationId}_Assets_${timestamp}.json`;

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

}

/**
 * Download a self-contained HTML dashboard that visualizes the JSON export.
 */
function downloadLocationHTML(html, locationId, kind) {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const suffix = kind || 'Dashboard';
    const filename = `Location_${locationId}_${suffix}_${timestamp}.html`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/* ============================================================================
 * Linkage Map HTML — list+detail layout, mirror of build-linkage-doc.js.
 * Self-contained: no external assets, opens by double-clicking.
 * ========================================================================== */

const _LINKAGE_TYPE_META = {
    workflow:          { label: 'Workflows', emoji: '⚙️', order: 1, color: '#8B5CF6' },
    workflow_trigger:  { label: 'Workflow Triggers', emoji: '🎯', order: 2, color: '#A855F7' },
    tag:               { label: 'Tags', emoji: '🏷️', order: 3, color: '#EC4899' },
    custom_field:      { label: 'Custom Fields', emoji: '🧩', order: 4, color: '#10B981' },
    custom_value:      { label: 'Custom Values', emoji: '🔤', order: 5, color: '#14B8A6' },
    pipeline:          { label: 'Pipelines', emoji: '🪣', order: 6, color: '#F59E0B' },
    pipeline_stage:    { label: 'Pipeline Stages', emoji: '📍', order: 7, color: '#FBBF24' },
    calendar:          { label: 'Calendars', emoji: '📅', order: 8, color: '#3B82F6' },
    calendar_group:    { label: 'Calendar Groups', emoji: '🗂️', order: 9, color: '#60A5FA' },
    form:              { label: 'Forms', emoji: '📝', order: 10, color: '#0D9488' },
    survey:            { label: 'Surveys', emoji: '📊', order: 11, color: '#0EA5E9' },
    email_template:    { label: 'Email Templates', emoji: '✉️', order: 12, color: '#F97316' },
    funnel:            { label: 'Funnels', emoji: '🚀', order: 13, color: '#EF4444' },
    funnel_page:       { label: 'Funnel Pages', emoji: '📄', order: 14, color: '#F87171' },
    funnel_step:       { label: 'Funnel Steps', emoji: '➡️', order: 15, color: '#FCA5A5' },
    folder:            { label: 'Folders', emoji: '📁', order: 16, color: '#9CA3AF' },
    media:             { label: 'Media', emoji: '🖼️', order: 17, color: '#6366F1' },
    knowledge_base:    { label: 'Knowledge Bases', emoji: '📚', order: 18, color: '#8B5CF6' },
    ai_employee:       { label: 'AI Employees', emoji: '🤖', order: 19, color: '#D946EF' },
    voice_ai_agent:    { label: 'Voice AI Agents', emoji: '🎙️', order: 20, color: '#C026D3' },
    conversation_ai:   { label: 'Conversation AI', emoji: '💬', order: 21, color: '#A21CAF' },
    snippet:           { label: 'Snippets', emoji: '📎', order: 22, color: '#84CC16' },
    object:            { label: 'Custom Objects', emoji: '📦', order: 23, color: '#65A30D' },
    link:              { label: 'Short Links', emoji: '🔗', order: 24, color: '#06B6D4' }
};
function _ltMeta(t) { return _LINKAGE_TYPE_META[t] || { label: t, emoji: '•', order: 99, color: '#94A3B8' }; }

/** Force-directed layout (port of build-linkage-doc.js#computeLayout). */
function computeLinkageLayout(L) {
    const nodeIds = Object.keys(L.nodes);
    const n = nodeIds.length;
    if (n === 0) return { width: 1600, height: 1100, positions: {} };
    const W = 1600, H = 1100, CX = W / 2, CY = H / 2;
    const k = Math.sqrt((W * H) / Math.max(1, n));
    const positions = {};

    const types = Object.keys(L.byType).sort((a, b) => (_ltMeta(a).order - _ltMeta(b).order));
    const typeIdx = {};
    types.forEach((t, i) => { typeIdx[t] = i; });
    const typeCount = types.length;

    nodeIds.forEach((id, i) => {
        const nd = L.nodes[id];
        const ti = typeIdx[nd.type] || 0;
        const perType = (L.byType[nd.type] || []).length;
        const angleBase = (ti / Math.max(1, typeCount)) * Math.PI * 2;
        const radius = 180 + ((ti % 3) * 60) + (perType > 30 ? 120 : 0);
        const jitter = (Math.sin(i * 13.37) * 0.5 + 0.5) * 80;
        const subAngle = angleBase + ((i % 40) - 20) * 0.06;
        positions[id] = {
            x: CX + Math.cos(subAngle) * (radius + jitter),
            y: CY + Math.sin(subAngle) * (radius + jitter)
        };
    });

    const orphanIds = (L.stats && L.stats.orphanIds) || [];
    orphanIds.forEach((id, i) => {
        const a = (i / Math.max(1, orphanIds.length)) * Math.PI * 2;
        positions[id] = { x: CX + Math.cos(a) * 700, y: CY + Math.sin(a) * 480 };
    });

    const connected = nodeIds.filter((id) => (L.outbound[id] || L.inbound[id]));
    const connectedSet = {};
    connected.forEach((id) => { connectedSet[id] = 1; });
    const relevantEdges = L.edges.filter((e) => connectedSet[e.source] && connectedSet[e.target]);

    const iterations = connected.length > 400 ? 80 : 140;
    let temp = Math.min(W, H) / 8;
    const cooling = Math.pow(0.02, 1 / iterations);
    const minD = 4;

    const pos = {};
    connected.forEach((id) => { pos[id] = { x: positions[id].x, y: positions[id].y }; });
    const disp = {};

    for (let iter = 0; iter < iterations; iter++) {
        connected.forEach((id) => { disp[id] = { x: 0, y: 0 }; });
        for (let a = 0; a < connected.length; a++) {
            const idA = connected[a];
            const pa = pos[idA], da = disp[idA];
            for (let b = a + 1; b < connected.length; b++) {
                const idB = connected[b];
                const pb = pos[idB], db = disp[idB];
                let dx = pa.x - pb.x, dy = pa.y - pb.y;
                let d = Math.sqrt(dx * dx + dy * dy);
                if (d < minD) d = minD;
                const f = (k * k) / d;
                const ux = dx / d, uy = dy / d;
                da.x += ux * f; da.y += uy * f;
                db.x -= ux * f; db.y -= uy * f;
            }
        }
        relevantEdges.forEach((e) => {
            const ps = pos[e.source], pt = pos[e.target];
            if (!ps || !pt) return;
            const dx = ps.x - pt.x, dy = ps.y - pt.y;
            let d = Math.sqrt(dx * dx + dy * dy);
            if (d < minD) d = minD;
            const f = (d * d) / k;
            const ux = dx / d, uy = dy / d;
            disp[e.source].x -= ux * f; disp[e.source].y -= uy * f;
            disp[e.target].x += ux * f; disp[e.target].y += uy * f;
        });
        connected.forEach((id) => {
            const p = pos[id], d = disp[id];
            d.x += (CX - p.x) * 0.005;
            d.y += (CY - p.y) * 0.005;
            const m = Math.sqrt(d.x * d.x + d.y * d.y);
            if (m < 0.001) return;
            const lim = Math.min(m, temp);
            p.x += (d.x / m) * lim;
            p.y += (d.y / m) * lim;
            p.x = Math.max(40, Math.min(W - 40, p.x));
            p.y = Math.max(40, Math.min(H - 40, p.y));
        });
        temp *= cooling;
    }
    connected.forEach((id) => { positions[id] = pos[id]; });
    return { width: W, height: H, positions: positions };
}

/**
 * Build the standalone Linkage map HTML — same UX as build-linkage-doc.js.
 * Reuses computeAssetLinkage() so node/edge extraction stays in one place.
 */
function buildLocationLinkageHTML(locationId, jsonData) {
    const L = computeAssetLinkage(jsonData);

    // Derive stats + analytics (the top-level computeAssetLinkage returns only
    // the basic graph; we compute the rest here so the function stays focused).
    const nodeIds = Object.keys(L.nodes);
    const orphanIds = nodeIds.filter((id) => !L.outbound[id] && !L.inbound[id]);
    const totalNodes = nodeIds.length;
    const totalEdges = L.edges.length;
    const orphanCount = orphanIds.length;
    const connectedCount = totalNodes - orphanCount;
    L.stats = { totalNodes, totalEdges, orphanCount, connectedCount, orphanIds };

    const degree = (id) => ((L.outbound[id] || []).length + (L.inbound[id] || []).length);
    const topNodes = nodeIds
        .map((id) => ({ n: L.nodes[id], d: degree(id) }))
        .filter((x) => x.d > 0)
        .sort((a, b) => b.d - a.d)
        .slice(0, 20);
    const unrefByType = (type) => (L.byType[type] || [])
        .filter((id) => !L.inbound[id])
        .map((id) => L.nodes[id]);
    L.analytics = {
        topNodes,
        deadTags: unrefByType('tag'),
        deadCustomFields: unrefByType('custom_field'),
        deadEmailTemplates: unrefByType('email_template')
    };

    const layout = computeLinkageLayout(L);
    const meta = jsonData._exportMetadata || {};

    const typesPresent = Object.keys(L.byType).sort((a, b) => (_ltMeta(a).order - _ltMeta(b).order));

    // Compact per-node payload (outbound/inbound flattened to tuples)
    const compactNodes = {};
    Object.keys(L.nodes).forEach((id) => {
        const n = L.nodes[id];
        const e = (L.outbound[id] || []).map((x) => [x.target, x.label, x.category]);
        const i = (L.inbound[id] || []).map((x) => [x.source, x.label, x.category]);
        const xObj = {};
        for (const k in (n.extra || {})) {
            const v = n.extra[k];
            if (v !== undefined && v !== null && v !== '') xObj[k] = v;
        }
        compactNodes[id] = {
            n: n.name,
            t: n.type,
            x: Object.keys(xObj).length ? xObj : 0,
            e: e.length ? e : 0,
            i: i.length ? i : 0
        };
    });

    const compactTypes = {};
    typesPresent.forEach((t) => {
        const m = _ltMeta(t);
        compactTypes[t] = { l: m.label, c: m.color, e: m.emoji };
    });

    const compactGroups = {};
    typesPresent.forEach((t) => {
        compactGroups[t] = (L.byType[t] || []).slice().sort((a, b) => {
            const an = (L.nodes[a].name || '').toLowerCase();
            const bn = (L.nodes[b].name || '').toLowerCase();
            return an < bn ? -1 : an > bn ? 1 : 0;
        });
    });

    const inlineData = {
        meta: {
            locationId: locationId || '',
            exportDate: meta.exportDate || '',
            totalNodes: L.stats.totalNodes,
            totalEdges: L.stats.totalEdges,
            orphanCount: L.stats.orphanCount,
            connectedCount: L.stats.connectedCount
        },
        types: compactTypes,
        nodes: compactNodes,
        groups: compactGroups,
        attention: {
            orphans: L.stats.orphanIds || [],
            deadTags: L.analytics.deadTags.map((n) => n.id),
            deadFields: L.analytics.deadCustomFields.map((n) => n.id),
            deadEmails: L.analytics.deadEmailTemplates.map((n) => n.id),
            hot: (L.analytics.topNodes || []).slice(0, 10).map((x) => ({ id: x.n.id, d: x.d }))
        },
        layoutW: layout.width,
        layoutH: layout.height,
        layout: layout.positions
    };

    const safePayload = JSON.stringify(inlineData)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e');
    const safeLocId = String(locationId || '').replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );

    return _buildLinkageHtmlShell(safeLocId, meta.exportDate || '', L, safePayload);
}

/** The HTML/CSS/JS template for the linkage page. Kept verbatim from
 *  build-linkage-doc.js so both outputs stay UX-identical. */
function _buildLinkageHtmlShell(safeLocId, exportDate, L, safePayload) {
    const total = L.stats.totalNodes;
    const edgeCount = L.stats.totalEdges;
    const orphans = L.stats.orphanCount;
    const connected = L.stats.connectedCount;
    const connectedPct = Math.round((100 * connected) / Math.max(1, total));
    const fmt = (n) => Number(n || 0).toLocaleString();

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Asset Linkage · ${safeLocId || 'Location'}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root {
  --bg: #fafaf9; --surface: #ffffff; --surface-2: #f8fafc;
  --border: #e5e7eb; --border-strong: #d1d5db;
  --text: #0f172a; --text-2: #334155; --muted: #64748b; --muted-2: #94a3b8;
  --accent: #8B5CF6; --accent-hover: #7c3aed; --accent-soft: #f5f3ff;
  --warn: #f59e0b; --warn-soft: #fffbeb;
  --danger: #ef4444; --danger-soft: #fef2f2;
  --success: #10b981;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  font-size: 14px; line-height: 1.5; color: var(--text); background: var(--bg);
  -webkit-font-smoothing: antialiased;
  height: 100vh; overflow: hidden;
}
button { font-family: inherit; cursor: pointer; }
a { color: var(--accent-hover); text-decoration: none; }
a:hover { text-decoration: underline; }

.app { display: grid; grid-template-columns: 320px 1fr; grid-template-rows: 56px 1fr; height: 100vh; overflow: hidden; }
.topbar { grid-column: 1 / -1; display: flex; align-items: center; gap: 16px; padding: 0 20px; border-bottom: 1px solid var(--border); background: var(--surface); }
.topbar .brand { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.topbar .logo { font-size: 18px; }
.topbar .title { font-size: 14px; font-weight: 600; color: var(--text); }
.topbar .loc { font-family: var(--mono); font-size: 11.5px; color: var(--muted); padding: 2px 8px; background: var(--accent-soft); border-radius: 999px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px; }
.topbar .search-wrap { flex: 1; position: relative; max-width: 540px; }
.topbar #search { width: 100%; padding: 8px 36px 8px 36px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); font-size: 13.5px; color: var(--text); font-family: inherit; }
.topbar #search:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(139,92,246,.15); }
.topbar .search-wrap::before { content: ""; position: absolute; left: 11px; top: 50%; width: 14px; height: 14px; transform: translateY(-50%); background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2364748b'><path fill-rule='evenodd' d='M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z' clip-rule='evenodd'/></svg>"); background-repeat: no-repeat; }
.topbar kbd { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); padding: 1px 6px; font-family: var(--mono); font-size: 11px; border: 1px solid var(--border); border-radius: 4px; color: var(--muted); background: var(--surface); }
.topbar #search.has-value + kbd { display: none; }
.btn { appearance: none; padding: 7px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: 12.5px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; transition: all .12s; }
.btn:hover { border-color: var(--accent); color: var(--accent-hover); background: var(--accent-soft); }

.sidebar { border-right: 1px solid var(--border); background: var(--surface); overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; }
.sidebar .attention { padding: 10px 12px; border-bottom: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 6px; }
.chip { appearance: none; border: 1px solid var(--border); background: var(--surface); padding: 4px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 500; color: var(--muted); display: inline-flex; align-items: center; gap: 5px; cursor: pointer; transition: all .12s; }
.chip:hover { border-color: var(--border-strong); color: var(--text-2); }
.chip.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.chip .ct { font-variant-numeric: tabular-nums; }
.chip.warn { background: var(--warn-soft); color: #92400e; border-color: #fcd34d; }
.chip.warn.active { background: var(--warn); color: #fff; border-color: var(--warn); }
.chip.danger { background: var(--danger-soft); color: #991b1b; border-color: #fecaca; }
.chip.danger.active { background: var(--danger); color: #fff; border-color: var(--danger); }

.sidebar .types { flex: 1; padding: 6px 0 12px; }
.type-group { border-bottom: 1px solid #f1f5f9; }
.type-group:last-child { border-bottom: none; }
.type-group > summary { list-style: none; cursor: pointer; padding: 9px 14px; display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 12.5px; color: var(--text-2); user-select: none; }
.type-group > summary::-webkit-details-marker { display: none; }
.type-group > summary::before { content: "▸"; color: var(--muted-2); font-size: 9px; width: 10px; display: inline-block; transition: transform .12s; }
.type-group[open] > summary::before { transform: rotate(90deg); }
.type-group > summary:hover { background: var(--surface-2); color: var(--text); }
.type-group .tg-emoji { font-size: 13px; }
.type-group .tg-label { flex: 1; }
.type-group .tg-count { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; background: var(--surface-2); border: 1px solid var(--border); padding: 0 6px; border-radius: 999px; }
.type-group .tg-issue { font-size: 10.5px; color: var(--warn); padding: 0 6px; background: var(--warn-soft); border: 1px solid #fde68a; border-radius: 999px; margin-left: 4px; font-variant-numeric: tabular-nums; }
.type-group ul.assets { list-style: none; margin: 0; padding: 2px 0 6px; }
.type-group .asset-item { appearance: none; width: 100%; text-align: left; background: transparent; border: none; padding: 5px 14px 5px 32px; font-size: 12.5px; color: var(--text-2); border-radius: 0; display: flex; align-items: center; gap: 8px; min-width: 0; position: relative; }
.type-group .asset-item:hover { background: var(--surface-2); color: var(--text); }
.type-group .asset-item.active { background: var(--accent-soft); color: var(--accent-hover); font-weight: 600; }
.type-group .asset-item .ai-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.type-group .asset-item .ai-deg { font-size: 10.5px; color: var(--muted-2); font-variant-numeric: tabular-nums; }
.type-group .asset-item .ai-flag { width: 6px; height: 6px; border-radius: 50%; background: var(--warn); flex-shrink: 0; }
.type-group .asset-item.hidden { display: none; }
.type-group.hidden { display: none; }
.no-results { padding: 24px 14px; text-align: center; color: var(--muted); font-size: 12.5px; display: none; }
.no-results.show { display: block; }

.detail { overflow-y: auto; padding: 0; background: var(--bg); }
.detail-inner { max-width: 920px; margin: 0 auto; padding: 32px 36px 56px; }

.welcome h1 { font-size: 22px; font-weight: 700; color: var(--text); margin: 0 0 6px; }
.welcome .subtitle { color: var(--muted); font-size: 13.5px; margin: 0 0 28px; }
.hero-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 32px; }
.hero-stat { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; }
.hero-stat .num { font-size: 28px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; line-height: 1.1; }
.hero-stat .lab { font-size: 12px; color: var(--muted); margin-top: 4px; text-transform: uppercase; letter-spacing: .04em; }
.hero-stat.danger .num { color: var(--danger); }

.section-h { font-size: 11.5px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; margin: 8px 0 12px; }
.attention-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-bottom: 28px; }
.attention-card { appearance: none; text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; cursor: pointer; transition: all .12s; display: flex; align-items: center; gap: 12px; }
.attention-card:hover { border-color: var(--accent); background: var(--accent-soft); }
.attention-card .ac-icon { font-size: 22px; flex-shrink: 0; }
.attention-card .ac-num { font-size: 18px; font-weight: 700; color: var(--text); }
.attention-card .ac-lab { font-size: 12px; color: var(--muted-2); }
.attention-card.warn { border-color: #fde68a; background: var(--warn-soft); }
.attention-card.warn:hover { border-color: var(--warn); background: #fef3c7; }
.attention-card.warn .ac-num { color: #92400e; }
.attention-card.danger { border-color: #fecaca; background: var(--danger-soft); }
.attention-card.danger:hover { border-color: var(--danger); background: #fee2e2; }
.attention-card.danger .ac-num { color: var(--danger); }

.hot-list { list-style: none; margin: 0 0 28px; padding: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.hot-list li { border-bottom: 1px solid var(--border); }
.hot-list li:last-child { border-bottom: none; }
.hot-list button { appearance: none; width: 100%; text-align: left; background: transparent; border: none; padding: 11px 16px; display: flex; align-items: center; gap: 12px; color: var(--text); }
.hot-list button:hover { background: var(--surface-2); }
.hot-list .rank { font-variant-numeric: tabular-nums; color: var(--muted-2); font-size: 12px; min-width: 24px; }
.hot-list .h-emoji { font-size: 14px; }
.hot-list .h-name { flex: 1; font-size: 13.5px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hot-list .h-kind { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.hot-list .h-deg { font-size: 11.5px; font-variant-numeric: tabular-nums; color: var(--accent-hover); background: var(--accent-soft); padding: 2px 9px; border-radius: 999px; font-weight: 600; }

.welcome-hint { color: var(--muted); font-size: 12.5px; text-align: center; padding: 12px 0; }

.asset-view { display: none; }
.asset-view.active { display: block; }
.welcome.hidden { display: none; }

.av-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid var(--border); }
.av-emoji { width: 40px; height: 40px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
.av-titles { flex: 1; min-width: 0; }
.av-kind { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 2px; }
.av-name { font-size: 20px; font-weight: 700; color: var(--text); margin: 0 0 6px; word-break: break-word; }
.av-id { font-family: var(--mono); font-size: 11.5px; color: var(--muted-2); }
.av-id code { background: var(--surface-2); border: 1px solid var(--border); padding: 1px 6px; border-radius: 4px; }
.av-actions { display: flex; gap: 6px; flex-shrink: 0; }

.av-degree { display: flex; gap: 14px; margin-bottom: 22px; font-size: 12.5px; color: var(--muted-2); }
.av-degree b { color: var(--text); font-weight: 600; font-variant-numeric: tabular-nums; }
.av-degree .deg-arr { color: var(--accent); font-weight: 700; margin-right: 4px; }

.av-meta { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 18px; margin-bottom: 22px; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px 24px; }
.av-meta .mp { font-size: 12.5px; }
.av-meta .mp .k { display: block; font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; font-weight: 600; margin-bottom: 2px; }
.av-meta .mp .v { color: var(--text); word-break: break-word; }

.av-section { margin-bottom: 22px; }
.av-section h3 { font-size: 11.5px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; margin: 0 0 10px; display: flex; align-items: center; gap: 8px; }
.av-section h3 .count { background: var(--surface-2); border: 1px solid var(--border); color: var(--text-2); font-size: 10.5px; padding: 1px 7px; border-radius: 999px; font-variant-numeric: tabular-nums; }

.mini-graph { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 8px; }
.mini-graph svg { width: 100%; display: block; }
.mini-empty { color: var(--muted); font-size: 12.5px; padding: 22px; text-align: center; }

.edge-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.edge-list li { padding: 9px 14px; display: flex; align-items: center; gap: 10px; background: var(--surface); border-bottom: 1px solid var(--border); font-size: 13px; }
.edge-list li:last-child { border-bottom: none; }
.edge-list .eg-arr { color: var(--accent); font-weight: 700; flex-shrink: 0; }
.edge-list .eg-label { color: var(--text-2); font-size: 12.5px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.edge-list .eg-target { appearance: none; background: transparent; border: none; padding: 0; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; color: var(--accent-hover); font-weight: 500; max-width: 280px; min-width: 0; }
.edge-list .eg-target:hover { text-decoration: underline; }
.edge-list .eg-target .eg-emoji { font-size: 12px; }
.edge-list .eg-target .eg-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.edge-list .eg-target .eg-kind { color: var(--muted-2); font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; }

.modal { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 24px; }
.modal[hidden] { display: none; }
.modal-overlay { position: absolute; inset: 0; background: rgba(15, 23, 42, .55); backdrop-filter: blur(2px); }
.modal-panel { position: relative; background: var(--surface); border-radius: 14px; width: 100%; max-width: 1280px; height: calc(100vh - 48px); display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 16px 48px rgba(15, 23, 42, .25); }
.modal-head { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--border); }
.modal-head h3 { margin: 0; font-size: 14px; font-weight: 600; color: var(--text); flex: 1; }
.modal-close { appearance: none; background: var(--surface-2); border: 1px solid var(--border); width: 30px; height: 30px; border-radius: 8px; font-size: 18px; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; }
.modal-close:hover { color: var(--danger); background: var(--danger-soft); border-color: var(--danger); }
.modal-body { flex: 1; min-height: 0; position: relative; background: #fafaf9; background-image: radial-gradient(circle, #e5e7eb 1px, transparent 1px); background-size: 24px 24px; cursor: grab; }
.modal-body.dragging { cursor: grabbing; }
.modal-body svg { width: 100%; height: 100%; display: block; user-select: none; }
.modal-loader { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; color: var(--accent-hover); font-weight: 600; background: rgba(255,255,255,.85); }
.gedge { stroke: #cbd5e1; stroke-width: 0.8; stroke-opacity: 0.5; pointer-events: none; }
.gedge.fk { stroke: #10b981; }
.gedge.action { stroke: #f97316; }
.gedge.token { stroke: #3b82f6; }
.gedge.condition { stroke: #d946ef; }
.gedge.form_field { stroke: #14b8a6; }
.gedge.highlight { stroke-opacity: 1; stroke-width: 2; }
.gedge.dim { stroke-opacity: 0.05; }
.gnode { cursor: pointer; }
.gnode circle { transition: stroke-width .12s; }
.gnode.selected circle { stroke: #0f172a; stroke-width: 3; }
.gnode.highlight circle { stroke: var(--accent-hover); stroke-width: 3; }
.gnode.dim { opacity: 0.18; }

@media (max-width: 880px) {
  .app { grid-template-columns: 1fr; grid-template-rows: 56px auto 1fr; }
  .sidebar { border-right: none; border-bottom: 1px solid var(--border); max-height: 40vh; }
  .topbar { flex-wrap: wrap; gap: 10px; padding: 10px 14px; height: auto; }
  .detail-inner { padding: 20px 16px 40px; }
}
</style>
</head>
<body>
<div class="app">
  <header class="topbar">
    <div class="brand">
      <span class="logo">🔗</span>
      <span class="title">Asset Linkage</span>
      ${safeLocId ? `<span class="loc" title="Location ID">${safeLocId}</span>` : ''}
    </div>
    <div class="search-wrap">
      <input id="search" type="search" placeholder="Search ${fmt(total)} assets…" autocomplete="off" autofocus>
      <kbd>/</kbd>
    </div>
    <button id="open-graph" class="btn" title="Open full network graph">📊 Graph</button>
  </header>

  <aside class="sidebar">
    <div class="attention" id="attention-chips"></div>
    <nav class="types" id="types"></nav>
    <div class="no-results" id="no-results">No assets match your search.</div>
  </aside>

  <main class="detail">
    <div class="detail-inner">
      <div class="welcome" id="welcome">
        <h1>${fmt(total)} assets · ${fmt(edgeCount)} connections</h1>
        <p class="subtitle">${exportDate ? `Exported ${new Date(exportDate).toLocaleString()}` : 'Linkage map'}</p>
        <div class="hero-stats">
          <div class="hero-stat"><div class="num">${fmt(connected)}</div><div class="lab">Connected · ${connectedPct}%</div></div>
          <div class="hero-stat"><div class="num">${fmt(edgeCount)}</div><div class="lab">Cross-references</div></div>
          <div class="hero-stat ${orphans > 0 ? 'danger' : ''}"><div class="num">${fmt(orphans)}</div><div class="lab">Orphans</div></div>
        </div>
        <h2 class="section-h">Needs attention</h2>
        <div class="attention-cards" id="attention-cards"></div>
        <h2 class="section-h">Most referenced assets</h2>
        <ol class="hot-list" id="hot-list"></ol>
        <p class="welcome-hint">Tip: press <kbd style="font-family:var(--mono);font-size:11px;border:1px solid var(--border);border-radius:4px;padding:1px 6px;background:var(--surface);color:var(--muted)">/</kbd> to focus search · click any chip or asset to drill in.</p>
      </div>

      <article class="asset-view" id="asset-view" hidden>
        <header class="av-head">
          <span class="av-emoji" id="av-emoji">·</span>
          <div class="av-titles">
            <div class="av-kind" id="av-kind"></div>
            <h1 class="av-name" id="av-name"></h1>
            <div class="av-id">ID: <code id="av-id"></code></div>
          </div>
          <div class="av-actions">
            <button class="btn" id="av-graph">📊 In graph</button>
            <button class="btn" id="av-back">← Back</button>
          </div>
        </header>
        <div class="av-degree" id="av-degree"></div>
        <div class="av-meta" id="av-meta"></div>
        <section class="av-section" id="av-mini-section">
          <h3>1-hop neighborhood</h3>
          <div class="mini-graph" id="av-mini"></div>
        </section>
        <section class="av-section" id="av-uses-section" hidden>
          <h3>Uses <span class="count" id="av-uses-count"></span></h3>
          <ul class="edge-list" id="av-uses"></ul>
        </section>
        <section class="av-section" id="av-usedby-section" hidden>
          <h3>Used by <span class="count" id="av-usedby-count"></span></h3>
          <ul class="edge-list" id="av-usedby"></ul>
        </section>
      </article>
    </div>
  </main>
</div>

<div class="modal" id="modal" hidden>
  <div class="modal-overlay" id="modal-overlay"></div>
  <div class="modal-panel">
    <header class="modal-head">
      <h3>Full network · ${fmt(total)} nodes · ${fmt(edgeCount)} connections</h3>
      <button class="modal-close" id="modal-close">×</button>
    </header>
    <div class="modal-body" id="modal-body">
      <div class="modal-loader" id="modal-loader" hidden>Rendering graph…</div>
    </div>
  </div>
</div>

<script>
window.LINK = ${safePayload};
${_LINKAGE_RUNTIME_JS}
</script>
</body>
</html>`;
}

/** Client-side runtime — kept identical to build-linkage-doc.js's. */
const _LINKAGE_RUNTIME_JS = `
(function () {
  var L = window.LINK;
  var T = L.types;
  var N = L.nodes;
  var G = L.groups;
  var A = L.attention;
  var $ = function (id) { return document.getElementById(id); };
  var SVGNS = 'http://www.w3.org/2000/svg';
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmt(n) { return Number(n || 0).toLocaleString(); }
  function tm(t) { return T[t] || { l: t, c: '#94A3B8', e: '•' }; }
  function deg(id) { var nd = N[id]; if (!nd) return 0; return (nd.e ? nd.e.length : 0) + (nd.i ? nd.i.length : 0); }

  var deadById = {};
  ['orphans','deadTags','deadFields','deadEmails'].forEach(function(k){ (A[k]||[]).forEach(function(id){ deadById[id] = true; }); });

  function buildSidebar() {
    var chips = $('attention-chips');
    var defs = [
      { key: 'orphans',    label: 'Orphans',     count: A.orphans.length,    cls: 'danger' },
      { key: 'deadTags',   label: 'Dead tags',   count: A.deadTags.length,   cls: 'warn' },
      { key: 'deadFields', label: 'Dead fields', count: A.deadFields.length, cls: 'warn' },
      { key: 'deadEmails', label: 'Dead emails', count: A.deadEmails.length, cls: 'warn' }
    ].filter(function(d){ return d.count > 0; });
    if (defs.length === 0) {
      chips.innerHTML = '<span style="font-size:11.5px;color:var(--muted);padding:2px 4px">No cleanup needed — every asset is referenced.</span>';
    } else {
      chips.innerHTML = defs.map(function(d){
        return '<button class="chip ' + d.cls + '" data-attn="' + d.key + '">' + esc(d.label) + ' <span class="ct">' + fmt(d.count) + '</span></button>';
      }).join('');
    }
    var typesEl = $('types');
    var html = '';
    Object.keys(G).forEach(function (t) {
      var meta = tm(t);
      var ids = G[t];
      var deadCount = ids.filter(function(id){ return deadById[id]; }).length;
      html += '<details class="type-group" data-type="' + esc(t) + '">';
      html += '<summary><span class="tg-emoji">' + meta.e + '</span><span class="tg-label">' + esc(meta.l) + '</span><span class="tg-count">' + fmt(ids.length) + '</span>';
      if (deadCount > 0) html += '<span class="tg-issue" title="Unreferenced">' + fmt(deadCount) + '</span>';
      html += '</summary><ul class="assets">';
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i]; var nd = N[id]; var d = deg(id); var isDead = !!deadById[id];
        html += '<li><button class="asset-item" data-id="' + esc(id) + '">';
        if (isDead) html += '<span class="ai-flag" title="Unreferenced"></span>';
        html += '<span class="ai-name">' + esc(nd.n) + '</span>';
        if (d > 0) html += '<span class="ai-deg">' + d + '</span>';
        html += '</button></li>';
      }
      html += '</ul></details>';
    });
    typesEl.innerHTML = html;
  }

  function buildWelcome() {
    var ac = $('attention-cards');
    var cards = [];
    if (A.orphans.length)    cards.push({ icon: '🪦', num: A.orphans.length,    lab: 'orphan assets',  key: 'orphans',    cls: 'danger' });
    if (A.deadTags.length)   cards.push({ icon: '🏷️', num: A.deadTags.length,   lab: 'unused tags',     key: 'deadTags',   cls: 'warn' });
    if (A.deadFields.length) cards.push({ icon: '🧩', num: A.deadFields.length, lab: 'unused fields',   key: 'deadFields', cls: 'warn' });
    if (A.deadEmails.length) cards.push({ icon: '✉️', num: A.deadEmails.length, lab: 'unused emails',   key: 'deadEmails', cls: 'warn' });
    if (cards.length === 0) cards.push({ icon: '✨', num: 0, lab: 'Nothing to clean up · every asset is referenced', key: '', cls: '' });
    ac.innerHTML = cards.map(function (c) {
      return '<button class="attention-card ' + c.cls + '" ' + (c.key ? 'data-attn="' + c.key + '"' : '') + '>'
           + '<span class="ac-icon">' + c.icon + '</span>'
           + '<div><div class="ac-num">' + fmt(c.num) + '</div><div class="ac-lab">' + esc(c.lab) + '</div></div>'
           + '</button>';
    }).join('');
    var hl = $('hot-list');
    hl.innerHTML = A.hot.map(function (h, i) {
      var nd = N[h.id]; if (!nd) return '';
      var meta = tm(nd.t);
      return '<li><button data-id="' + esc(h.id) + '">'
        + '<span class="rank">' + (i + 1) + '</span>'
        + '<span class="h-emoji">' + meta.e + '</span>'
        + '<span class="h-name">' + esc(nd.n) + '</span>'
        + '<span class="h-kind">' + esc(meta.l.replace(/s$/, '')) + '</span>'
        + '<span class="h-deg">' + h.d + ' refs</span>'
        + '</button></li>';
    }).join('');
  }

  function renderAsset(id) {
    var nd = N[id]; if (!nd) return false;
    var meta = tm(nd.t);
    $('welcome').classList.add('hidden');
    var av = $('asset-view'); av.hidden = false; av.classList.add('active');
    var emoji = $('av-emoji'); emoji.textContent = meta.e; emoji.style.background = meta.c + '22'; emoji.style.color = meta.c;
    $('av-kind').textContent = meta.l.replace(/s$/, '');
    $('av-name').textContent = nd.n;
    $('av-id').textContent = id;
    $('av-graph').setAttribute('data-focus', id);
    var outs = nd.e || [], ins = nd.i || [];
    $('av-degree').innerHTML = '<span><span class="deg-arr">→</span><b>' + outs.length + '</b> uses</span><span><span class="deg-arr">←</span><b>' + ins.length + '</b> used by</span>';
    var mp = $('av-meta');
    if (nd.x && Object.keys(nd.x).length) {
      mp.innerHTML = Object.keys(nd.x).map(function (k) {
        var v = nd.x[k]; if (typeof v === 'object') v = JSON.stringify(v);
        return '<div class="mp"><span class="k">' + esc(formatKey(k)) + '</span><span class="v">' + esc(v) + '</span></div>';
      }).join('');
      mp.style.display = '';
    } else { mp.style.display = 'none'; }
    renderMiniGraph(id, outs, ins);
    fillEdges('av-uses', outs, '→');
    fillEdges('av-usedby', ins, '←');
    $('av-uses-section').hidden = outs.length === 0;
    $('av-usedby-section').hidden = ins.length === 0;
    $('av-uses-count').textContent = outs.length;
    $('av-usedby-count').textContent = ins.length;
    document.querySelectorAll('.asset-item.active').forEach(function (el) { el.classList.remove('active'); });
    var item = document.querySelector('.asset-item[data-id="' + cssEscape(id) + '"]');
    if (item) {
      item.classList.add('active');
      var grp = item.closest('details.type-group');
      if (grp && !grp.open) grp.open = true;
      if (item.scrollIntoView) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    document.querySelector('.detail').scrollTop = 0;
    history.replaceState(null, '', '#' + id);
    return true;
  }
  function clearAsset() {
    var av = $('asset-view'); av.hidden = true; av.classList.remove('active');
    $('welcome').classList.remove('hidden');
    document.querySelectorAll('.asset-item.active').forEach(function (el) { el.classList.remove('active'); });
    history.replaceState(null, '', location.pathname + location.search);
  }
  function formatKey(k) { return k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); }); }
  function fillEdges(targetId, list, arrow) {
    var el = $(targetId);
    if (!list.length) { el.innerHTML = ''; return; }
    var html = '';
    list.forEach(function (e) {
      var otherId = e[0], label = e[1];
      var other = N[otherId];
      if (!other) {
        html += '<li><span class="eg-arr">' + arrow + '</span><span class="eg-label">' + esc(label) + '</span><span class="eg-target" style="color:var(--danger)">missing · ' + esc(otherId) + '</span></li>';
        return;
      }
      var m = tm(other.t);
      html += '<li><span class="eg-arr">' + arrow + '</span><span class="eg-label">' + esc(label) + '</span>'
        + '<button class="eg-target" data-id="' + esc(otherId) + '">'
        + '<span class="eg-emoji">' + m.e + '</span>'
        + '<span class="eg-name">' + esc(other.n) + '</span>'
        + '<span class="eg-kind">· ' + esc(m.l.replace(/s$/, '')) + '</span>'
        + '</button></li>';
    });
    el.innerHTML = html;
  }
  function cssEscape(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, function (c) { return '\\\\' + c; }); }

  function renderMiniGraph(id, outs, ins) {
    var el = $('av-mini'); var section = $('av-mini-section');
    if (!outs.length && !ins.length) { el.innerHTML = '<div class="mini-empty">No connections — this asset is an orphan.</div>'; section.hidden = false; return; }
    section.hidden = false;
    var seen = {}, neighbors = [];
    outs.forEach(function (e) { if (!seen[e[0]]) { seen[e[0]] = 1; neighbors.push({ id: e[0], dir: 'out', label: e[1], cat: e[2] }); } });
    ins.forEach(function (e) { if (!seen[e[0]]) { seen[e[0]] = 1; neighbors.push({ id: e[0], dir: 'in', label: e[1], cat: e[2] }); } });
    var W = 600, H = 360, CX = W / 2, CY = H / 2;
    var max = Math.min(neighbors.length, 30);
    var hidden = neighbors.length - max;
    var ring = Math.min(135, 60 + max * 4);
    var nd = N[id]; var meta = tm(nd.t);
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="' + SVGNS + '">';
    for (var i = 0; i < max; i++) {
      var nb = neighbors[i];
      var ang = (i / max) * Math.PI * 2 - Math.PI / 2;
      var x = CX + Math.cos(ang) * ring, y = CY + Math.sin(ang) * ring;
      svg += '<line x1="' + CX + '" y1="' + CY + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + edgeColor(nb.cat) + '" stroke-width="1.4" stroke-opacity="0.7"></line>';
    }
    svg += '<circle cx="' + CX + '" cy="' + CY + '" r="22" fill="' + meta.c + '" stroke="#fff" stroke-width="3"></circle>';
    svg += '<text x="' + CX + '" y="' + (CY + 4) + '" text-anchor="middle" font-size="14" fill="#fff" font-family="-apple-system, sans-serif">' + meta.e + '</text>';
    for (var j = 0; j < max; j++) {
      var nb2 = neighbors[j]; var nb2node = N[nb2.id];
      var ang2 = (j / max) * Math.PI * 2 - Math.PI / 2;
      var x2 = CX + Math.cos(ang2) * ring, y2 = CY + Math.sin(ang2) * ring;
      var nbMeta = tm(nb2node.t); var arrow = nb2.dir === 'out' ? '→' : '←';
      svg += '<g class="mg-node" data-id="' + esc(nb2.id) + '" style="cursor:pointer">';
      svg += '<circle cx="' + x2.toFixed(1) + '" cy="' + y2.toFixed(1) + '" r="11" fill="' + nbMeta.c + '" stroke="#fff" stroke-width="2"></circle>';
      svg += '<text x="' + x2.toFixed(1) + '" y="' + (y2 + 3.5).toFixed(1) + '" text-anchor="middle" font-size="11" fill="#fff" font-family="-apple-system, sans-serif">' + nbMeta.e + '</text>';
      var lx = CX + Math.cos(ang2) * (ring + 22), ly = CY + Math.sin(ang2) * (ring + 22);
      var anchor = lx > CX + 8 ? 'start' : (lx < CX - 8 ? 'end' : 'middle');
      var nameShort = nb2node.n.length > 22 ? nb2node.n.slice(0, 20) + '…' : nb2node.n;
      svg += '<text x="' + lx.toFixed(1) + '" y="' + (ly + 4).toFixed(1) + '" text-anchor="' + anchor + '" font-size="10.5" fill="#334155" font-family="-apple-system, sans-serif">' + esc(arrow + ' ' + nameShort) + '</text>';
      svg += '<title>' + esc(nb2.dir === 'out' ? 'uses' : 'used by') + ': ' + esc(nb2node.n) + '\\n' + esc(nb2.label) + '</title>';
      svg += '</g>';
    }
    if (hidden > 0) svg += '<text x="' + CX + '" y="' + (H - 12) + '" text-anchor="middle" font-size="11" fill="#94A3B8">… and ' + hidden + ' more</text>';
    svg += '</svg>';
    el.innerHTML = svg;
    el.querySelectorAll('.mg-node').forEach(function (g) {
      g.addEventListener('click', function () { renderAsset(g.getAttribute('data-id')); });
    });
  }
  function edgeColor(cat) { return ({ fk: '#10b981', action: '#f97316', token: '#3b82f6', condition: '#d946ef', form_field: '#14b8a6' })[cat] || '#94A3B8'; }

  var searchInput = $('search');
  var allItems = null;
  function refreshItems() { allItems = Array.prototype.slice.call(document.querySelectorAll('.asset-item')); }
  function runSearch() {
    var q = (searchInput.value || '').trim().toLowerCase();
    searchInput.classList.toggle('has-value', q.length > 0);
    if (!allItems) refreshItems();
    var matched = 0;
    allItems.forEach(function (el) {
      var name = (el.querySelector('.ai-name').textContent || '').toLowerCase();
      var id = el.getAttribute('data-id').toLowerCase();
      var hit = !q || name.indexOf(q) !== -1 || id.indexOf(q) !== -1;
      el.classList.toggle('hidden', !hit);
      if (hit) matched++;
    });
    document.querySelectorAll('details.type-group').forEach(function (grp) {
      var visible = grp.querySelectorAll('.asset-item:not(.hidden)').length;
      grp.classList.toggle('hidden', visible === 0);
      if (q && visible > 0) grp.open = true;
    });
    $('no-results').classList.toggle('show', q && matched === 0);
  }
  searchInput.addEventListener('input', runSearch);

  var activeAttn = null;
  function applyAttnFilter(key) {
    activeAttn = (activeAttn === key) ? null : key;
    if (!allItems) refreshItems();
    document.querySelectorAll('.chip[data-attn]').forEach(function (c) { c.classList.toggle('active', c.getAttribute('data-attn') === activeAttn); });
    if (!activeAttn) {
      allItems.forEach(function (el) { el.classList.remove('hidden'); });
      document.querySelectorAll('details.type-group').forEach(function (g) { g.classList.remove('hidden'); });
      runSearch();
      return;
    }
    var ids = A[activeAttn] || [];
    var idSet = {}; ids.forEach(function (id) { idSet[id] = 1; });
    allItems.forEach(function (el) { el.classList.toggle('hidden', !idSet[el.getAttribute('data-id')]); });
    document.querySelectorAll('details.type-group').forEach(function (grp) {
      var visible = grp.querySelectorAll('.asset-item:not(.hidden)').length;
      grp.classList.toggle('hidden', visible === 0);
      if (visible > 0) grp.open = true;
    });
    searchInput.value = ''; searchInput.classList.remove('has-value');
    $('no-results').classList.toggle('show', ids.length === 0);
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    var item = t.closest && t.closest('.asset-item, .eg-target, .hot-list button');
    if (item && item.getAttribute('data-id')) { e.preventDefault(); renderAsset(item.getAttribute('data-id')); return; }
    var attn = t.closest && t.closest('[data-attn]');
    if (attn) { e.preventDefault(); applyAttnFilter(attn.getAttribute('data-attn')); return; }
    if (t.id === 'av-back') { clearAsset(); return; }
    if (t.id === 'av-graph' || (t.closest && t.closest('#av-graph'))) {
      var id = $('av-graph').getAttribute('data-focus'); openModal(id); return;
    }
    if (t.id === 'open-graph' || (t.closest && t.closest('#open-graph'))) { openModal(null); return; }
    if (t.id === 'modal-close' || t.id === 'modal-overlay') { closeModal(); return; }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== searchInput) { e.preventDefault(); searchInput.focus(); searchInput.select(); }
    else if (e.key === 'Escape') {
      if (!$('modal').hidden) { closeModal(); return; }
      if (document.activeElement === searchInput) { searchInput.value = ''; runSearch(); searchInput.blur(); }
      else if (!$('asset-view').hidden) { clearAsset(); }
    }
  });

  var modalRendered = false, modalState = null;
  function openModal(focusId) {
    var modal = $('modal'); modal.hidden = false;
    if (!modalRendered) {
      var loader = $('modal-loader'); loader.hidden = false;
      setTimeout(function () { renderModalGraph(); loader.hidden = true; if (focusId) focusInModal(focusId); }, 30);
    } else if (focusId) { focusInModal(focusId); }
  }
  function closeModal() { $('modal').hidden = true; }

  function renderModalGraph() {
    modalRendered = true;
    var W = L.layoutW, H = L.layoutH, pos = L.layout;
    var body = $('modal-body');
    var svg = '<svg id="m-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" xmlns="' + SVGNS + '"><g id="m-vp">';
    var edges = [];
    Object.keys(N).forEach(function (id) {
      var nd = N[id]; if (!nd.e) return;
      nd.e.forEach(function (e) {
        var p1 = pos[id], p2 = pos[e[0]]; if (!p1 || !p2) return;
        edges.push({ s: id, t: e[0], c: e[2], x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      });
    });
    var edgeStr = edges.map(function (e) {
      return '<line class="gedge ' + e.c + '" data-s="' + esc(e.s) + '" data-t="' + esc(e.t) + '" x1="' + e.x1.toFixed(1) + '" y1="' + e.y1.toFixed(1) + '" x2="' + e.x2.toFixed(1) + '" y2="' + e.y2.toFixed(1) + '"></line>';
    }).join('');
    svg += '<g id="m-edges">' + edgeStr + '</g><g id="m-nodes">';
    Object.keys(N).forEach(function (id) {
      var nd = N[id]; var p = pos[id]; if (!p) return;
      var d = deg(id); var r = (4 + Math.min(12, Math.sqrt(d) * 1.8)).toFixed(1);
      var meta = tm(nd.t);
      svg += '<g class="gnode" data-id="' + esc(id) + '" transform="translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ')">'
        + '<circle r="' + r + '" fill="' + meta.c + '" stroke="#fff" stroke-width="1.4"></circle>'
        + '<title>' + esc(nd.n) + ' — ' + esc(meta.l.replace(/s$/, '')) + ' (' + d + ' refs)</title></g>';
    });
    svg += '</g></g></svg>';
    body.innerHTML = svg + body.innerHTML;
    wireModalInteractivity();
  }
  function wireModalInteractivity() {
    var svg = $('m-svg'); var vp = $('m-vp'); var body = $('modal-body');
    var vx = 0, vy = 0, vs = 1; var drag = null;
    function apply() { vp.setAttribute('transform', 'translate(' + vx + ',' + vy + ') scale(' + vs + ')'); }
    body.addEventListener('mousedown', function (e) { if (e.target.closest && e.target.closest('.gnode')) return; drag = { x: e.clientX, y: e.clientY, vx: vx, vy: vy }; body.classList.add('dragging'); });
    window.addEventListener('mousemove', function (e) { if (!drag) return; vx = drag.vx + (e.clientX - drag.x); vy = drag.vy + (e.clientY - drag.y); apply(); });
    window.addEventListener('mouseup', function () { drag = null; body.classList.remove('dragging'); });
    body.addEventListener('wheel', function (e) {
      e.preventDefault();
      var rect = svg.getBoundingClientRect(); var mx = e.clientX - rect.left, my = e.clientY - rect.top;
      var newVs = Math.max(0.2, Math.min(4, vs * (1 + (-e.deltaY * 0.0015))));
      var ratio = newVs / vs; vx = mx - (mx - vx) * ratio; vy = my - (my - vy) * ratio; vs = newVs; apply();
    }, { passive: false });
    svg.querySelectorAll('.gnode').forEach(function (g) {
      g.addEventListener('click', function (e) { e.stopPropagation(); var id = g.getAttribute('data-id'); highlightInModal(id); renderAsset(id); });
    });
    body.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.gnode')) return; clearModalHighlight(); });
    modalState = { apply: apply, setView: function (x, y, s) { vx = x; vy = y; vs = s; apply(); }, svg: svg, body: body };
  }
  function highlightInModal(id) {
    var nodes = document.querySelectorAll('#m-svg .gnode');
    var edges = document.querySelectorAll('#m-svg .gedge');
    var neigh = {}; neigh[id] = 1;
    var inc = [];
    edges.forEach(function (e) { var s = e.getAttribute('data-s'), t = e.getAttribute('data-t'); if (s === id || t === id) { inc.push(e); neigh[s] = 1; neigh[t] = 1; } });
    nodes.forEach(function (g) {
      var nid = g.getAttribute('data-id');
      g.classList.toggle('selected', nid === id);
      g.classList.toggle('highlight', nid !== id && !!neigh[nid]);
      g.classList.toggle('dim', !neigh[nid]);
    });
    edges.forEach(function (e) { var hi = inc.indexOf(e) !== -1; e.classList.toggle('highlight', hi); e.classList.toggle('dim', !hi); });
  }
  function clearModalHighlight() {
    document.querySelectorAll('#m-svg .gnode, #m-svg .gedge').forEach(function (el) { el.classList.remove('selected', 'highlight', 'dim'); });
  }
  function focusInModal(id) {
    if (!modalState) return;
    var p = L.layout[id]; if (!p) return;
    var rect = modalState.svg.getBoundingClientRect();
    var vb = modalState.svg.viewBox.baseVal;
    var newVs = 2;
    var px = p.x * (rect.width / vb.width), py = p.y * (rect.height / vb.height);
    var nx = rect.width / 2 - px * newVs, ny = rect.height / 2 - py * newVs;
    modalState.setView(nx, ny, newVs);
    highlightInModal(id);
  }

  buildSidebar();
  buildWelcome();
  refreshItems();
  var initial = (location.hash || '').slice(1);
  if (initial && N[initial]) { setTimeout(function () { renderAsset(initial); }, 0); }
})();
`;

/**
 * Build a single-file HTML dashboard from the same jsonData that gets written
 * to the .json export. Zero external dependencies — CSS and JS are inlined,
 * data is embedded as a JSON blob, so the file opens by double-clicking.
 *
 * Features:
 *  - Sidebar TOC with live counts per asset type
 *  - Collapsible sections (native <details>)
 *  - Folder grouping where assets carry a `folder` field
 *  - Clickable deep-links to the asset in GHL
 *  - Cross-reference chips (tags → workflows, trigger links → usedInX)
 *  - Global search that filters rendered cards
 *  - Per-card "Full data" reveal for the complete enrichment object
 */
function buildLocationDashboardHTML(locationId, jsonData) {
    // Escape </script> and control chars so the JSON is safe inside <script>
    const safeJson = JSON.stringify(jsonData)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    const safeLocationId = JSON.stringify(locationId || '');
    const exportedAt = new Date().toISOString();

    const css = `
:root {
    --bg: #faf8ff;
    --panel: #ffffff;
    --panel-tint: #faf5ff;
    --border: #ede9fe;
    --border-strong: #ddd6fe;
    --text: #1f1433;
    --muted: #6b7280;
    --muted-strong: #4b5563;
    --accent: #8B5CF6;
    --accent-hover: #7c3aed;
    --accent-deep: #6d28d9;
    --accent-soft: #f5f3ff;
    --accent-softer: #faf5ff;
    --accent-border: #d8b4fe;
    --chip-bg: #f5f3ff;
    --chip-border: #e9d5ff;
    --chip-text: #6b21a8;
    --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --danger: #dc2626;
    --ok: #16a34a;
    --brand-gradient: linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%);
    --brand-gradient-soft: linear-gradient(135deg, #f5f3ff 0%, #faf5ff 100%);
    --shadow-sm: 0 1px 2px rgba(76, 29, 149, 0.05);
    --shadow-md: 0 4px 12px rgba(139, 92, 246, 0.12);
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    color: var(--text);
    background: var(--brand-gradient-soft);
    background-attachment: fixed;
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
}
a { color: var(--accent-hover); }
.layout { display: grid; grid-template-columns: 280px 1fr; min-height: 100vh; }
aside {
    position: sticky; top: 0; height: 100vh; overflow-y: auto;
    border-right: 1px solid var(--border); background: var(--panel);
    padding: 0; box-shadow: var(--shadow-sm);
}
aside .brand {
    background: var(--brand-gradient);
    padding: 20px 20px 18px;
    color: #ffffff;
    margin-bottom: 14px;
}
aside .brand-title {
    display: flex; align-items: center; gap: 8px;
    font-size: 16px; font-weight: 700; margin: 0 0 4px;
    text-shadow: 0 1px 2px rgba(0,0,0,0.1);
}
aside .brand-logo {
    width: 26px; height: 26px; border-radius: 6px;
    background: rgba(255,255,255,0.22); display: inline-flex;
    align-items: center; justify-content: center; font-size: 14px;
}
aside .brand-badge {
    background: rgba(255,255,255,0.25); color: #ffffff; font-size: 10px;
    font-weight: 600; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px;
}
aside .brand-tagline {
    font-size: 12px; color: #f3e8ff; margin: 0;
}
aside .location-box {
    margin: 0 16px 14px; padding: 10px 12px;
    background: var(--accent-softer); border: 1px solid var(--accent-border);
    border-radius: 8px;
}
aside .location-box .label {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--accent-deep); font-weight: 600; margin-bottom: 3px;
}
aside .location-box code {
    font-family: var(--mono); font-size: 11.5px; color: var(--text);
    word-break: break-all; display: block;
}
aside .nav-wrap { padding: 0 12px 20px; }
aside .nav-title {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--muted); font-weight: 700; padding: 0 8px 8px; margin: 0;
}
.nav { display: flex; flex-direction: column; gap: 1px; }
.nav a {
    display: flex; justify-content: space-between; align-items: center;
    padding: 7px 10px; border-radius: 6px; text-decoration: none; color: var(--text);
    font-size: 13px; transition: background 0.15s, color 0.15s;
}
.nav a:hover { background: var(--accent-soft); color: var(--accent-hover); }
.nav a.active { background: var(--accent-soft); color: var(--accent-deep); font-weight: 600; }
.nav .count {
    background: var(--panel); border: 1px solid var(--border-strong);
    border-radius: 999px; padding: 1px 8px; font-size: 11px; color: var(--muted-strong);
    font-variant-numeric: tabular-nums;
}
.nav a:hover .count, .nav a.active .count { background: var(--accent); color: #ffffff; border-color: var(--accent); }
main { padding: 28px 36px 48px; max-width: 1240px; margin: 0 auto; width: 100%; }
header.pageheader { margin-bottom: 20px; }
header.pageheader h1 {
    margin: 0 0 6px; font-size: 26px; font-weight: 700;
    background: var(--brand-gradient); -webkit-background-clip: text;
    background-clip: text; -webkit-text-fill-color: transparent; display: inline-block;
}
header.pageheader .meta { color: var(--muted-strong); font-size: 13px; }
header.pageheader .meta code { font-family: var(--mono); font-size: 12px; background: var(--chip-bg); padding: 1px 6px; border-radius: 4px; color: var(--chip-text); }
header.pageheader .meta .divider { color: var(--border-strong); margin: 0 8px; }
.search-wrap { margin: 18px 0 10px; position: relative; }
#search {
    width: 100%; padding: 11px 16px 11px 40px;
    border: 1px solid var(--border-strong); border-radius: 10px;
    font-size: 14px; font-family: inherit; background: var(--panel);
    color: var(--text); transition: border-color 0.15s, box-shadow 0.15s;
}
#search::placeholder { color: var(--muted); }
#search:focus {
    outline: none; border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
}
.search-wrap::before {
    content: ""; position: absolute; left: 14px; top: 50%;
    width: 16px; height: 16px; transform: translateY(-50%);
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%238B5CF6'><path fill-rule='evenodd' d='M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z' clip-rule='evenodd'/></svg>");
    background-repeat: no-repeat; background-size: contain; pointer-events: none;
}
.section {
    margin: 16px 0; border: 1px solid var(--border); border-radius: 12px;
    background: var(--panel); overflow: hidden; box-shadow: var(--shadow-sm);
    scroll-margin-top: 16px;
}
.section > summary {
    list-style: none; cursor: pointer; padding: 14px 18px;
    display: flex; align-items: center; gap: 12px; user-select: none;
    font-weight: 600; font-size: 15px; color: var(--text);
    transition: background 0.15s;
}
.section > summary:hover { background: var(--accent-softer); }
.section[open] > summary { background: var(--accent-softer); border-bottom: 1px solid var(--border); }
.section > summary::-webkit-details-marker { display: none; }
.section > summary::before {
    content: "▸"; color: var(--accent); transition: transform 0.15s;
    display: inline-block; width: 12px; font-size: 11px;
}
.section[open] > summary::before { transform: rotate(90deg); }
.section > summary .count {
    margin-left: auto; background: var(--brand-gradient); color: #ffffff;
    border-radius: 999px; padding: 2px 10px; font-size: 12px;
    font-weight: 600; font-variant-numeric: tabular-nums;
    box-shadow: 0 1px 2px rgba(139,92,246,0.3);
}
.section > .body { padding: 4px 18px 18px; }
.folder-group { margin-top: 14px; border-radius: 8px; overflow: hidden; }
.folder-group > summary {
    cursor: pointer; padding: 8px 12px; background: var(--accent-soft);
    border-radius: 6px; font-size: 13px; font-weight: 600; color: var(--accent-deep);
    list-style: none; display: flex; align-items: center; gap: 6px;
}
.folder-group > summary::-webkit-details-marker { display: none; }
.folder-group > summary::before {
    content: "▸"; display: inline-block; width: 10px; color: var(--accent);
    transition: transform 0.15s;
}
.folder-group[open] > summary::before { transform: rotate(90deg); }
.folder-group > .items { padding: 8px 0 0 14px; }
.card {
    border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px;
    margin: 10px 0; background: var(--panel); transition: border-color 0.15s, box-shadow 0.15s;
    scroll-margin-top: 16px;
}
.card:hover { border-color: var(--border-strong); box-shadow: var(--shadow-sm); }
.card:target {
    border-color: var(--accent); box-shadow: 0 0 0 3px rgba(139,92,246,0.18);
    animation: targetFlash 1.4s ease-out;
}
@keyframes targetFlash {
    0% { background: var(--accent-soft); }
    100% { background: var(--panel); }
}
.card.hidden { display: none; }
.card-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.card-title { font-weight: 600; font-size: 15px; margin: 0; color: var(--text); }
.card-id {
    font-family: var(--mono); font-size: 11px; color: var(--chip-text);
    background: var(--chip-bg); padding: 1px 6px; border-radius: 4px;
    border: 1px solid var(--chip-border);
}
.card-head a.open-in-ghl {
    margin-left: auto; font-size: 12px; color: var(--accent-hover); text-decoration: none;
    border: 1px solid var(--border-strong); border-radius: 6px; padding: 3px 10px;
    font-weight: 500; transition: all 0.15s;
}
.card-head a.open-in-ghl:hover {
    background: var(--accent); color: #ffffff; border-color: var(--accent);
}
.fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px 20px; margin: 12px 0 4px; }
.field { font-size: 13px; min-width: 0; }
.field .label {
    color: var(--muted-strong); font-size: 10.5px; text-transform: uppercase;
    letter-spacing: 0.06em; font-weight: 600; display: block; margin-bottom: 3px;
}
.field .value { word-break: break-word; color: var(--text); }
.field .value code, .field code {
    font-family: var(--mono); font-size: 12px; background: var(--chip-bg);
    padding: 2px 6px; border-radius: 4px; color: var(--chip-text);
    border: 1px solid var(--chip-border); word-break: break-all;
}
.field .value a { color: var(--accent-hover); text-decoration: none; word-break: break-all; }
.field .value a:hover { text-decoration: underline; }
/* email_actions html preview — rendered email lives inside a sandboxed iframe */
.field-html { grid-column: 1 / -1; }
.html-preview-toggle { margin-top: 4px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--chip-bg); }
.html-preview-toggle > summary {
    cursor: pointer; padding: 8px 12px; font-size: 12px; font-weight: 600;
    color: var(--accent-deep); text-transform: uppercase; letter-spacing: 0.05em;
    list-style: none; user-select: none;
}
.html-preview-toggle > summary::-webkit-details-marker { display: none; }
.html-preview-toggle > summary::before {
    content: "▶"; display: inline-block; margin-right: 6px; font-size: 10px;
    transition: transform 0.15s;
}
.html-preview-toggle[open] > summary::before { transform: rotate(90deg); }
.html-preview-wrap {
    background: #ffffff; border-top: 1px solid var(--border-strong);
    border-radius: 0 0 8px 8px; padding: 8px; overflow: hidden;
}
.html-preview {
    width: 100%; min-height: 360px; max-height: 720px; border: 0;
    background: #ffffff; border-radius: 4px;
}
.chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 2px; }
.chip {
    background: var(--chip-bg); border: 1px solid var(--chip-border); border-radius: 999px;
    padding: 2px 10px; font-size: 11.5px; color: var(--chip-text); font-weight: 500;
}
.chip.accent { background: var(--accent-soft); border-color: var(--accent-border); color: var(--accent-deep); }
a.chip {
    text-decoration: none; cursor: pointer; transition: all 0.15s;
    display: inline-flex; align-items: center; gap: 4px;
}
a.chip:hover { background: var(--accent); color: #ffffff; border-color: var(--accent); }
a.chip::after {
    content: "↗"; font-size: 9.5px; opacity: 0.6;
}
.refs { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-strong); }
.refs .refs-label {
    font-size: 10.5px; text-transform: uppercase; color: var(--accent-deep);
    letter-spacing: 0.06em; font-weight: 700; margin-bottom: 6px;
}
.refs .ref-row { margin: 4px 0; font-size: 12.5px; display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; }
.refs .ref-row b {
    font-weight: 600; color: var(--muted-strong); font-size: 11px;
    min-width: 90px; text-transform: uppercase; letter-spacing: 0.04em;
}
.full-data { margin-top: 12px; }
.full-data > summary {
    font-size: 11.5px; color: var(--muted-strong); cursor: pointer; list-style: none;
    padding: 4px 8px; border-radius: 4px; display: inline-flex; align-items: center;
    gap: 4px; font-weight: 500;
}
.full-data > summary:hover { background: var(--accent-soft); color: var(--accent-hover); }
.full-data > summary::-webkit-details-marker { display: none; }
.full-data > summary::before {
    content: "▸"; display: inline-block; width: 10px; color: var(--accent);
    transition: transform 0.15s;
}
.full-data[open] > summary::before { transform: rotate(90deg); }
.full-data pre {
    background: #1e1b2e; color: #e9d5ff; padding: 14px; border-radius: 8px;
    font-family: var(--mono); font-size: 11.5px; line-height: 1.55; max-height: 420px;
    overflow: auto; margin: 8px 0 0; border: 1px solid #3f3357;
}
.swatch {
    display: inline-block; width: 12px; height: 12px; border-radius: 3px;
    vertical-align: middle; border: 1px solid var(--border-strong); margin-right: 6px;
}
.empty { color: var(--muted); font-style: italic; font-size: 13px; padding: 10px 0; }
.notice {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border: 1px solid #fcd34d; color: #78350f; padding: 10px 14px;
    border-radius: 8px; font-size: 13px; margin: 16px 0;
}

/* --- Tab bar --- */
.view-toggle {
    display: inline-flex; gap: 4px; padding: 4px;
    background: var(--panel); border: 1px solid var(--border-strong);
    border-radius: 10px; box-shadow: var(--shadow-sm); margin-bottom: 18px;
}
.view-toggle button {
    appearance: none; border: none; background: transparent; cursor: pointer;
    padding: 8px 16px; font-size: 13px; font-weight: 600; color: var(--muted-strong);
    border-radius: 7px; font-family: inherit; transition: all 0.15s;
    display: inline-flex; align-items: center; gap: 6px;
}
.view-toggle button:hover { color: var(--accent-hover); background: var(--accent-softer); }
.view-toggle button.active {
    background: var(--brand-gradient); color: #ffffff;
    box-shadow: 0 2px 6px rgba(139,92,246,0.3);
}
.view-toggle button.active:hover { color: #ffffff; }
.view-toggle .tab-count {
    background: rgba(255,255,255,0.25); color: inherit; border-radius: 999px;
    padding: 1px 7px; font-size: 11px; font-weight: 600;
    font-variant-numeric: tabular-nums;
}
.view-toggle button:not(.active) .tab-count {
    background: var(--chip-bg); color: var(--chip-text);
}

/* --- Tab panes --- */
.tab-pane { display: none; }
.tab-pane.active { display: block; animation: fadeIn 0.2s ease-out; }
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
}

/* --- Stat cards grid (Overview) --- */
.stat-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px; margin-bottom: 20px;
}
.stat-card {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 12px; padding: 14px 16px; box-shadow: var(--shadow-sm);
    position: relative; overflow: hidden; transition: transform 0.15s, box-shadow 0.15s;
}
.stat-card:hover { transform: translateY(-1px); box-shadow: var(--shadow-md); }
.stat-card::before {
    content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: var(--brand-gradient);
}
.stat-card .stat-label {
    display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--muted-strong); font-weight: 600; margin-bottom: 6px;
}
.stat-card .stat-value {
    display: block; font-size: 26px; font-weight: 700; line-height: 1.15;
    color: var(--text); font-variant-numeric: tabular-nums;
    background: var(--brand-gradient); -webkit-background-clip: text;
    background-clip: text; -webkit-text-fill-color: transparent;
}
.stat-card .stat-sub {
    display: block; font-size: 11.5px; color: var(--muted); margin-top: 4px;
}

/* --- Chart cards --- */
.panels {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    gap: 14px; margin-bottom: 20px;
}
.panel {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 12px; padding: 16px 18px; box-shadow: var(--shadow-sm);
}
.panel h3 {
    font-size: 13px; font-weight: 700; color: var(--text); margin: 0 0 2px;
    text-transform: uppercase; letter-spacing: 0.05em;
}
.panel .panel-sub {
    font-size: 11.5px; color: var(--muted); margin: 0 0 12px;
}
.panel.full { grid-column: 1 / -1; }
.panel-empty { color: var(--muted); font-style: italic; font-size: 13px; padding: 12px 0; }

/* --- Bar chart (SVG) --- */
.chart-svg { width: 100%; height: auto; display: block; overflow: visible; }
.chart-svg text.label { fill: var(--text); font-family: inherit; }
.chart-svg text.value { fill: var(--muted-strong); font-family: inherit; }
.chart-svg rect.bar { transition: opacity 0.15s; }
.chart-svg rect.bar:hover { opacity: 0.85; cursor: default; }

/* --- Donut / status segmented bar --- */
.seg-bar {
    display: flex; height: 14px; border-radius: 999px; overflow: hidden;
    background: var(--chip-bg); margin: 8px 0 12px;
}
.seg-bar .seg { height: 100%; transition: filter 0.15s; }
.seg-bar .seg:hover { filter: brightness(1.08); }
.seg-legend { display: flex; flex-wrap: wrap; gap: 10px 14px; font-size: 12px; }
.seg-legend-item { display: inline-flex; align-items: center; gap: 6px; color: var(--muted-strong); }
.seg-legend-item .dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.seg-legend-item b { color: var(--text); font-variant-numeric: tabular-nums; font-weight: 600; }

/* --- Top list --- */
.top-list { display: flex; flex-direction: column; gap: 6px; }
.top-list .row {
    display: grid; grid-template-columns: 1fr auto; gap: 10px;
    align-items: center; font-size: 13px; padding: 6px 8px;
    border-radius: 6px; transition: background 0.15s;
}
.top-list .row:hover { background: var(--accent-softer); }
.top-list .row a { color: var(--accent-hover); text-decoration: none; }
.top-list .row a:hover { text-decoration: underline; }
.top-list .row .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.top-list .row .val {
    color: var(--chip-text); background: var(--chip-bg); border: 1px solid var(--chip-border);
    border-radius: 999px; padding: 1px 10px; font-size: 11.5px; font-weight: 600;
    font-variant-numeric: tabular-nums; white-space: nowrap;
}

/* --- Assets toolbar --- */
.assets-toolbar {
    position: sticky; top: 0; z-index: 5; background: var(--brand-gradient-soft);
    padding: 12px 0; margin: -4px -4px 6px; backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
}
.assets-toolbar-inner {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
}
.assets-toolbar .tool-btn {
    appearance: none; background: var(--panel); border: 1px solid var(--border-strong);
    color: var(--muted-strong); font-family: inherit; font-size: 12px; font-weight: 600;
    padding: 7px 12px; border-radius: 8px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 5px;
    transition: all 0.15s;
}
.assets-toolbar .tool-btn:hover {
    color: var(--accent-hover); border-color: var(--accent-border);
    background: var(--accent-softer);
}
.assets-toolbar .match-count {
    font-size: 12px; color: var(--muted-strong); margin-left: auto;
    font-variant-numeric: tabular-nums;
}
.assets-toolbar .match-count b { color: var(--accent-deep); }

/* --- Search enhancements --- */
#searchClear {
    position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
    appearance: none; background: var(--chip-bg); border: 1px solid var(--chip-border);
    color: var(--chip-text); border-radius: 999px; width: 22px; height: 22px;
    display: none; align-items: center; justify-content: center;
    cursor: pointer; font-size: 14px; line-height: 1; padding: 0;
    transition: all 0.15s;
}
#searchClear:hover { background: var(--accent); color: #ffffff; border-color: var(--accent); }
.search-wrap.has-value #searchClear { display: inline-flex; }
.search-wrap kbd {
    position: absolute; right: 42px; top: 50%; transform: translateY(-50%);
    background: var(--panel); border: 1px solid var(--border-strong);
    border-radius: 4px; padding: 1px 6px; font-size: 11px; font-family: var(--mono);
    color: var(--muted-strong); pointer-events: none;
    box-shadow: 0 1px 0 var(--border-strong);
}
.search-wrap.has-value kbd { display: none; }
mark.hit {
    background: #fde68a; color: #78350f; padding: 0 2px;
    border-radius: 2px; font-weight: 600;
}

/* --- Copy button --- */
.copy-btn {
    appearance: none; background: transparent; border: none; cursor: pointer;
    color: var(--chip-text); font-size: 11px; padding: 1px 4px; margin-left: 2px;
    border-radius: 3px; opacity: 0.5; transition: all 0.15s;
    display: inline-flex; align-items: center; justify-content: center;
    vertical-align: baseline; font-family: inherit;
}
.copy-btn:hover { opacity: 1; color: var(--accent-hover); background: var(--accent-soft); }
.copy-btn.copied { color: var(--ok); opacity: 1; }

/* --- Active TOC highlight --- */
.nav a.active { background: var(--accent-soft); color: var(--accent-deep); font-weight: 600; }

/* --- No results --- */
.no-results {
    text-align: center; padding: 40px 20px; color: var(--muted);
    background: var(--panel); border: 1px dashed var(--border-strong);
    border-radius: 12px; margin: 20px 0; display: none;
}
.no-results.show { display: block; }
.no-results .icon { font-size: 32px; margin-bottom: 8px; opacity: 0.5; }

/* --- Linkage / Graph view --- */
.linkage-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px,1fr)); gap: 8px; margin: 10px 0 16px; }
.linkage-pill { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; box-shadow: var(--shadow-sm); font-size: 11.5px; }
.linkage-pill .k { display: block; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted-strong); font-weight: 600; }
.linkage-pill .v { display: block; font-size: 18px; font-weight: 700; color: var(--accent-deep); font-variant-numeric: tabular-nums; margin-top: 2px; }

/* Attention cards — cleanup-driven callouts */
.attn-cards { margin: 12px 0 16px; }
.attn-h { font-size: 11px; font-weight: 600; color: var(--muted-strong); text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 8px; }
.attn-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.attn-card { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; box-shadow: var(--shadow-sm); }
.attn-card .ac-icon { font-size: 20px; flex-shrink: 0; }
.attn-card .ac-num { font-size: 18px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; line-height: 1.1; }
.attn-card .ac-lab { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
.attn-card.warn { background: #fffbeb; border-color: #fde68a; }
.attn-card.warn .ac-num { color: #92400e; }
.attn-card.danger { background: #fef2f2; border-color: #fecaca; }
.attn-card.danger .ac-num { color: #b91c1c; }

/* Cleanup-candidates collapsible block */
.cleanup-details { margin: 14px 0; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow-sm); }
.cleanup-details > summary { list-style: none; cursor: pointer; padding: 12px 16px; font-size: 12.5px; font-weight: 600; color: var(--muted-strong); display: flex; align-items: center; gap: 8px; }
.cleanup-details > summary::-webkit-details-marker { display: none; }
.cleanup-details > summary::before { content: "▸"; color: var(--accent); font-size: 10px; transition: transform .15s; }
.cleanup-details[open] > summary::before { transform: rotate(90deg); }
.cleanup-details[open] > summary { border-bottom: 1px solid var(--border); }
.cleanup-details > .panels { padding: 14px; }
.cleanup-details > .panels .panel { box-shadow: none; }

.refs-edges { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-strong); display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.refs-edges .edges-col h5 { margin: 0 0 5px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent-deep); font-weight: 700; display: flex; align-items: center; gap: 6px; }
.refs-edges .edges-col h5 .cnt { background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--chip-text); font-size: 10px; border-radius: 999px; padding: 0 6px; font-weight: 600; }
.refs-edges ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
.refs-edges li { font-size: 11.5px; color: var(--muted-strong); display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.refs-edges li .arr { color: var(--accent); font-weight: 700; }
.refs-edges li.edge-fk .arr { color: #16a34a; }
.refs-edges li.edge-action .arr { color: #ea580c; }
.refs-edges li.edge-token .arr { color: #2563eb; }
.refs-edges li.edge-condition .arr { color: #c026d3; }
.refs-edges li.edge-form_field .arr { color: #0d9488; }
.refs-edges li .lbl { color: var(--text); }
.refs-edges li .ctx { color: var(--muted); font-size: 10.5px; font-style: italic; }
.refs-edges .more-btn { appearance: none; background: transparent; border: none; color: var(--accent-hover); font-size: 11px; cursor: pointer; padding: 2px 0; font-family: inherit; font-weight: 600; }
.refs-edges .more-btn:hover { text-decoration: underline; }
.ref-chip { display: inline-flex; align-items: center; gap: 4px; background: var(--chip-bg); border: 1px solid var(--chip-border); border-radius: 999px; padding: 1px 8px; font-size: 11px; color: var(--chip-text); text-decoration: none; font-weight: 500; transition: all 0.15s; }
.ref-chip:hover { background: var(--accent); color: #fff; border-color: var(--accent); }
.ref-chip .rk { font-size: 9.5px; text-transform: uppercase; color: var(--muted); letter-spacing: 0.04em; }
.ref-chip:hover .rk { color: rgba(255,255,255,0.85); }

.graph-btn-mini { appearance: none; background: var(--panel); border: 1px solid var(--border-strong); color: var(--muted-strong); width: 24px; height: 24px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: all 0.15s; padding: 0; }
.graph-btn-mini:hover { background: var(--accent); color: #fff; border-color: var(--accent); }
.degree-pill { font-size: 10.5px; color: var(--muted-strong); background: var(--accent-softer); border: 1px solid var(--border-strong); border-radius: 999px; padding: 1px 7px; font-variant-numeric: tabular-nums; }
.degree-pill .o { color: #16a34a; font-weight: 600; }
.degree-pill .i { color: #2563eb; font-weight: 600; }

.graph-shell { display: grid; grid-template-columns: 260px 1fr; gap: 14px; align-items: stretch; height: calc(100vh - 210px); min-height: 620px; }
.graph-sidebar { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 12px 12px 16px; overflow-y: auto; box-shadow: var(--shadow-sm); }
.graph-filter-block { border-bottom: 1px solid var(--border); padding: 8px 0 10px; }
.graph-filter-block:last-child { border-bottom: none; }
.graph-filter-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.graph-filter-head h4 { margin: 0; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 700; }
.graph-mini-btn { appearance: none; background: var(--panel); border: 1px solid var(--border-strong); color: var(--muted-strong); font-family: inherit; font-size: 10.5px; font-weight: 600; padding: 3px 8px; border-radius: 6px; cursor: pointer; margin-left: 4px; }
.graph-mini-btn:hover { color: var(--accent-hover); background: var(--accent-softer); }
.glegend { display: flex; flex-direction: column; gap: 1px; }
.glegend-item { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--text); padding: 3px 4px; border-radius: 6px; cursor: pointer; user-select: none; }
.glegend-item:hover { background: var(--accent-softer); }
.glegend-item input { margin: 0; accent-color: var(--accent); }
.glegend-item .swatch { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.glegend-item .cnt { margin-left: auto; font-size: 10.5px; color: var(--muted); font-variant-numeric: tabular-nums; background: var(--chip-bg); border: 1px solid var(--chip-border); border-radius: 999px; padding: 0 6px; }
.graph-selected-info { font-size: 12px; color: var(--muted-strong); }
.graph-selected-info .gsi-name { font-weight: 600; color: var(--text); font-size: 13px; margin-bottom: 3px; }
.graph-selected-info .gsi-kind { font-size: 10.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px; }
.graph-selected-info .gsi-id { font-family: var(--mono); font-size: 10.5px; background: var(--chip-bg); padding: 1px 6px; border-radius: 4px; color: var(--chip-text); border: 1px solid var(--chip-border); display: inline-block; margin-bottom: 6px; word-break: break-all; }
.graph-selected-info .gsi-deg { display: flex; gap: 8px; margin-bottom: 6px; font-size: 11px; }
.graph-selected-info .gsi-link { display: block; font-size: 11.5px; color: var(--accent-hover); margin-top: 6px; text-decoration: none; font-weight: 600; }
.graph-selected-info .gsi-link:hover { text-decoration: underline; }

.graph-canvas-wrap { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: var(--shadow-sm); }
.graph-toolbar { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--border); background: var(--panel-tint); flex-wrap: wrap; }
.graph-search-wrap { flex: 1 1 220px; max-width: 360px; }
#graph-search { width: 100%; padding: 7px 10px; border: 1px solid var(--border-strong); border-radius: 7px; font-size: 12.5px; background: var(--panel); font-family: inherit; }
#graph-search:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(139,92,246,0.15); }
.graph-hint { font-size: 11px; color: var(--muted); margin-left: auto; }
.graph-canvas { flex: 1 1 auto; overflow: hidden; position: relative; background: repeating-linear-gradient(0deg, var(--accent-softer), var(--accent-softer) 1px, transparent 1px, transparent 24px), repeating-linear-gradient(90deg, var(--accent-softer), var(--accent-softer) 1px, transparent 1px, transparent 24px), var(--panel); cursor: grab; }
.graph-canvas.dragging { cursor: grabbing; }
.graph-loader { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; color: var(--accent-deep); background: rgba(255,255,255,0.85); z-index: 10; font-weight: 600; }
#graph-svg { width: 100%; height: 100%; display: block; user-select: none; }
.gedge { stroke-width: 0.8; stroke-opacity: 0.45; pointer-events: none; transition: stroke-opacity 0.15s; }
.gedge.hide-by-cat, .gedge.hide-by-type { display: none; }
.gedge.highlight { stroke-opacity: 1 !important; stroke-width: 2; }
.gedge.dim { stroke-opacity: 0.08; }
.gnode { cursor: pointer; transition: opacity 0.15s; }
.gnode circle { transition: stroke-width 0.15s; }
.gnode.hide-by-type, .gnode.hide-by-orphan { display: none; }
.gnode.dim { opacity: 0.2; }
.gnode.highlight circle { stroke: var(--accent-deep); stroke-width: 3; }
.gnode.selected circle { stroke: #111; stroke-width: 3; }
.gnode.match circle { stroke: #f59e0b; stroke-width: 3; }
.glabel { font-size: 9.5px; fill: var(--text); pointer-events: none; font-family: inherit; font-weight: 500; }

@media (max-width: 860px) {
    .layout { grid-template-columns: 1fr; }
    aside { position: static; height: auto; }
    main { padding: 20px; }
    .assets-toolbar { position: static; }
    .graph-shell { grid-template-columns: 1fr; height: auto; }
    .graph-canvas-wrap { height: 70vh; }
    .refs-edges { grid-template-columns: 1fr; }
}
`;

    // Build the runtime JS as a plain string. Do NOT use nested template
    // literals here — keep everything as single-quoted strings or string
    // concatenation so the outer template literal doesn't get confused.
    const js = `
(function () {
    var DATA = window.SNAPSHOT_DATA || {};
    var LOC = window.LOCATION_ID || '';
    var GHL = LOC ? 'https://app.gohighlevel.com/v2/location/' + LOC : null;
    var GHL_V1 = LOC ? 'https://app.gohighlevel.com/location/' + LOC : null;

    // --- Type configuration -------------------------------------------------
    // For each asset-type key, describes how to render it.
    var TYPE_CONFIG = {
        custom_fields: {
            label: 'Custom Fields',
            folderField: 'folder',
            fields: ['dataType', 'model', 'fieldKey', 'placeholder', 'options'],
            link: function () { return GHL ? GHL + '/settings/fields' : null; }
        },
        custom_values: {
            label: 'Custom Values',
            folderField: 'folder',
            fields: ['value', 'type', 'fieldKey', 'description'],
            link: function (item) {
                if (!GHL) return null;
                var name = item && item.name;
                return name
                    ? GHL + '/settings/custom_values?page=1&query=' + encodeURIComponent(name)
                    : GHL + '/settings/custom_values';
            }
        },
        tags: {
            label: 'Tags',
            fields: ['color', 'contactCount', 'opportunityCount', 'totalUsage'],
            refFields: [{ key: 'workflowsUsingTag', label: 'Workflows', targetTypes: ['workflow'] }],
            link: function (item) {
                if (!GHL) return null;
                var name = item && item.name;
                return name
                    ? GHL + '/settings/tags?query=' + encodeURIComponent(name) + '&page=1'
                    : GHL + '/settings/tags';
            },
            colorField: 'color'
        },
        pipelines: {
            label: 'Pipelines',
            fields: ['showInFunnel', 'showInPieChart', 'stages'],
            link: function (item) {
                var id = item._id || item.id;
                if (!GHL) return null;
                return id ? GHL + '/opportunities/pipeline/' + id + '?tab=stages' : GHL + '/opportunities/pipeline';
            }
        },
        pipeline_stages: {
            label: 'Pipeline Stages',
            fields: ['pipelineName', 'position', 'showInFunnel'],
            link: function (item) {
                var pid = item.pipelineId;
                return GHL && pid ? GHL + '/opportunities/pipeline/' + pid + '?tab=stages' : null;
            }
        },
        calendars: {
            label: 'Calendars',
            fields: ['calendarType', 'widgetType', 'slotDuration', 'slotInterval', 'isActive'],
            link: function () {
                return GHL ? GHL + '/calendars/view' : null;
            }
        },
        calendar_groups: {
            label: 'Calendar Groups',
            fields: ['description', 'slug', 'isActive'],
            link: function () { return GHL ? GHL + '/settings/calendars' : null; }
        },
        calendar_configuration: {
            label: 'Calendar Configuration',
            fields: ['timezone', 'currency', 'country'],
            link: function () { return GHL ? GHL + '/settings/calendars/connections' : null; }
        },
        campaigns: {
            label: 'Campaigns',
            fields: ['status', 'totalRecipients', 'openRate', 'clickRate', 'bounceRate']
        },
        forms: {
            label: 'Forms',
            fields: ['submitButtonText', 'redirectUrl', 'successMessage', 'pixelTracking'],
            link: function (item) {
                var id = item._id || item.id;
                return GHL && id ? GHL + '/form-builder-v2/' + id : null;
            }
        },
        surveys: {
            label: 'Surveys',
            fields: ['submitButtonText', 'redirectUrl', 'pages'],
            link: function (item) {
                var id = item._id || item.id;
                return GHL && id ? GHL + '/survey-builder-v2/' + id : null;
            }
        },
        quizzes: {
            label: 'Quizzes',
            fields: ['submitButtonText', 'pages']
        },
        workflow: {
            label: 'Workflows',
            fields: ['status', 'version', 'totalSteps', 'triggers', 'tagsUsed', 'customFieldsUsed', 'smsCount', 'emailCount'],
            fullFields: ['aiDescription', 'aiSetupNotes', 'smsMessages', 'emailMessages'],
            link: function (item) {
                var id = item.id || item._id;
                return GHL_V1 && id ? GHL_V1 + '/workflow/' + id : null;
            }
        },
        workflow_triggers: {
            label: 'Workflow Triggers',
            fields: ['workflowName', 'eventType', 'filters']
        },
        email_actions: {
            label: 'Email Actions',
            fields: ['workflowName', 'actionName', 'subject', 'fromName', 'fromEmail', 'snippetName', 'triggerCount', 'triggers'],
            // html renders as an actual email preview (sandboxed iframe);
            // bodyPreview stays as plaintext for quick scanning + search.
            fullFields: ['bodyPreview', 'html'],
            htmlFields: ['html'],
            refFields: [
                { key: 'workflowName', label: 'Workflow', targetTypes: ['workflow'] }
            ],
            link: function (item) {
                var id = item.workflowId;
                return GHL_V1 && id ? GHL_V1 + '/workflow/' + id : null;
            }
        },
        email_templates: {
            label: 'Email Templates',
            folderField: 'folder',
            fields: ['templateType', 'subject', 'previewText', 'lastModified'],
            link: function (item) {
                var id = item._id || item.id;
                return GHL_V1 && id ? GHL_V1 + '/emails/create/' + id + '/builder?pageNumber=1' : null;
            }
        },
        email_builder: {
            label: 'Email Builder Templates',
            fields: ['subject', 'previewText'],
            link: function (item) {
                var id = item._id || item.id;
                return GHL_V1 && id ? GHL_V1 + '/emails/create/' + id + '/builder?pageNumber=1' : null;
            }
        },
        text_templates: { label: 'Text Templates', fields: ['body'] },
        snippets: {
            label: 'Snippets',
            folderField: 'folder',
            fields: ['body', 'bodyPreview'],
            link: function () { return GHL ? GHL + '/marketing/templates' : null; }
        },
        funnels: {
            label: 'Funnels',
            fields: ['description', 'siteType', 'domain', 'pageCount', 'stepCount'],
            link: function (item) {
                var id = item._id || item.id;
                return GHL && id ? GHL + '/funnels-websites/funnels/' + id : null;
            }
        },
        funnel_pages: { label: 'Funnel Pages', fields: ['funnelName', 'stepName', 'url', 'deleted'] },
        funnel_steps: { label: 'Funnel Steps', fields: ['funnelName', 'pageCount'] },
        funnel_element_counts: { label: 'Funnel Element Counts', fields: ['pageName', 'totalElements'] },
        links: {
            label: 'Trigger Links',
            fields: ['clickCount', 'uniqueClicks'],
            computedFields: [
                {
                    label: 'Link URL',
                    valueType: 'url',
                    compute: function (item) {
                        return item.redirectTo || item.fullUrl || item.shortUrl || '';
                    }
                },
                {
                    label: 'Link Key',
                    valueType: 'code',
                    compute: function (item) {
                        var id = item._id || item.id;
                        return id ? '{{trigger_link.' + id + '}}' : '';
                    }
                }
            ],
            refFields: [
                { key: 'usedInEmailTemplates', label: 'Email Templates', targetTypes: ['email_templates', 'email_builder'] },
                { key: 'usedInForms', label: 'Forms', targetTypes: ['forms'] },
                { key: 'usedInSurveys', label: 'Surveys', targetTypes: ['surveys'] },
                { key: 'usedInWorkflows', label: 'Workflows', targetTypes: ['workflow'] },
                { key: 'usedInFunnels', label: 'Funnels', targetTypes: ['funnels'] },
                { key: 'usedInTextTemplates', label: 'Text Templates', targetTypes: ['text_templates', 'snippets'] },
                { key: 'usedInCampaigns', label: 'Campaigns', targetTypes: ['campaigns'] }
            ],
            link: function () {
                return GHL ? GHL + '/marketing/trigger-links' : null;
            }
        },
        folders: {
            label: 'Folders',
            fields: ['parentId', 'path'],
            link: function () { return GHL ? GHL + '/media-storage' : null; }
        },
        media: {
            label: 'Media',
            fields: ['url', 'type', 'parentId', 'size'],
            link: function () { return GHL ? GHL + '/media-storage' : null; }
        },
        triggers: { label: 'Triggers', fields: ['eventType', 'filters'] },
        knowledge_bases: {
            label: 'Knowledge Bases',
            fields: ['slug', 'fileCount', 'urlCount', 'status'],
            link: function (item) {
                var id = item._id || item.id;
                return GHL && id ? GHL + '/ai-agents/knowledge-base/' + id : null;
            }
        },
        voice_ai_agents: {
            label: 'Voice AI Agents',
            fields: ['voice', 'language', 'greeting'],
            link: function (item) {
                var id = item._id || item.id;
                return GHL && id ? GHL + '/ai-agents/voice-ai/builder/' + id : null;
            }
        },
        ai_employees: {
            label: 'AI Employees',
            fields: ['role', 'persona', 'model'],
            link: function (item) {
                var id = item._id || item.id;
                return GHL && id ? GHL + '/ai-agents/conversation-ai/agent/' + id : null;
            }
        },
        conversation_ai: {
            label: 'Conversation AI',
            fields: ['role', 'persona', 'model'],
            link: function (item) {
                var id = item._id || item.id;
                return GHL && id ? GHL + '/ai-agents/conversation-ai/agent/' + id : null;
            }
        },
        documents: { label: 'Documents', fields: ['type', 'status'] },
        objects: {
            label: 'Custom Objects',
            fields: ['displayName', 'fieldCount'],
            link: function () { return GHL ? GHL + '/settings/objects' : null; }
        },
        dashboards: { label: 'Dashboards', fields: ['description', 'widgetCount'] },
        membership_offers: { label: 'Membership Offers', fields: ['price', 'productName'] },
        custom_objects: {
            label: 'Custom Objects',
            fields: ['displayName'],
            link: function () { return GHL ? GHL + '/settings/objects' : null; }
        }
    };

    // Human-friendly order; unknown keys append at the end.
    var TYPE_ORDER = [
        'workflow', 'workflow_triggers', 'email_actions', 'forms', 'surveys', 'quizzes',
        'funnels', 'funnel_pages', 'funnel_steps', 'funnel_element_counts',
        'email_templates', 'email_builder', 'text_templates', 'snippets',
        'campaigns', 'links', 'triggers',
        'tags', 'custom_fields', 'custom_values',
        'pipelines', 'pipeline_stages', 'calendars', 'calendar_groups', 'calendar_configuration',
        'knowledge_bases', 'voice_ai_agents', 'ai_employees', 'conversation_ai',
        'documents', 'objects', 'custom_objects', 'dashboards',
        'membership_offers', 'folders', 'media'
    ];

    // --- DOM helpers --------------------------------------------------------
    function el(tag, attrs, children) {
        var node = document.createElement(tag);
        if (attrs) {
            for (var k in attrs) {
                if (attrs[k] == null) continue;
                if (k === 'class') node.className = attrs[k];
                else if (k === 'text') node.textContent = attrs[k];
                else if (k === 'html') node.innerHTML = attrs[k];
                else node.setAttribute(k, attrs[k]);
            }
        }
        if (children) {
            for (var i = 0; i < children.length; i++) {
                var c = children[i];
                if (c == null) continue;
                node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
            }
        }
        return node;
    }

    function isArr(x) { return Array.isArray(x); }
    function isObj(x) { return x && typeof x === 'object' && !isArr(x); }

    function getList(raw) {
        if (!raw) return [];
        if (isArr(raw)) return raw;
        if (isObj(raw)) {
            // funnels came through as { funnels, pages, steps, ... }
            if (isArr(raw.funnels)) return raw.funnels;
            if (isArr(raw.items)) return raw.items;
            if (isArr(raw.list)) return raw.list;
            // Single-object sections (like calendar_configuration)
            return [raw];
        }
        return [];
    }

    function nameOf(item) {
        return item && (item.name || item.title || item.Name || item.subject || item.displayName || item.fieldKey) || '(unnamed)';
    }

    function idOf(item) {
        return item && (item._id || item.id || item.ID || '');
    }

    function formatValue(v) {
        if (v == null || v === '') return null;
        if (typeof v === 'boolean') return v ? 'Yes' : 'No';
        if (typeof v === 'number') return String(v);
        if (typeof v === 'string') return v;
        if (isArr(v)) return v.map(function (x) { return typeof x === 'object' ? JSON.stringify(x) : String(x); }).join('; ');
        if (isObj(v)) return JSON.stringify(v);
        return String(v);
    }

    function prettyLabel(s) {
        var out = String(s || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
        return out.charAt(0).toUpperCase() + out.slice(1);
    }

    function fieldNode(label, value, valueType) {
        if (value == null || value === '') return null;
        // For html valueType, skip the formatValue stringify path so we get
        // the raw HTML string into the iframe srcdoc.
        var str = valueType === 'html'
            ? (typeof value === 'string' ? value : String(value || ''))
            : formatValue(value);
        if (str == null || str === '') return null;
        if (valueType === 'html') {
            // Sandbox the iframe — no scripts, no same-origin, no top
            // navigation — so an email's HTML can render visually without
            // becoming an attack surface inside the dashboard.
            var frame = el('iframe', {
                class: 'html-preview',
                sandbox: '',
                srcdoc: str,
                loading: 'lazy'
            });
            var wrap = el('div', { class: 'html-preview-wrap' }, [frame]);
            // Collapsible so 30+ emails on one page don't blow up paint.
            var details = el('details', { class: 'html-preview-toggle', open: 'open' });
            details.appendChild(el('summary', null, ['Rendered email']));
            details.appendChild(wrap);
            return el('div', { class: 'field field-html' }, [
                el('span', { class: 'label' }, [prettyLabel(label)]),
                details
            ]);
        }
        var valueNode = el('span', { class: 'value' });
        if (valueType === 'url' && /^https?:\\/\\//i.test(str)) {
            var a = el('a', { href: str, target: '_blank', rel: 'noopener' }, [str]);
            valueNode.appendChild(a);
        } else if (valueType === 'code') {
            valueNode.appendChild(el('code', null, [str]));
        } else {
            valueNode.appendChild(document.createTextNode(str));
        }
        return el('div', { class: 'field' }, [
            el('span', { class: 'label' }, [prettyLabel(label)]),
            valueNode
        ]);
    }

    function colorSwatch(color) {
        if (!color || typeof color !== 'string') return null;
        var span = el('span', { class: 'swatch' });
        try { span.style.background = color; } catch (_) {}
        return span;
    }

    // NAME_INDEX maps typeKey -> lowercased name -> cardId (first match wins).
    // Populated in a pre-pass before cards are rendered so that ref chips
    // rendered on any card can deep-link to their target card.
    var NAME_INDEX = {};

    function cardIdFor(typeKey, item, fallbackIndex) {
        var id = idOf(item);
        if (id) return 'card-' + typeKey + '-' + String(id).replace(/[^A-Za-z0-9_-]/g, '_');
        return 'card-' + typeKey + '-i' + fallbackIndex;
    }

    function resolveRefTarget(name, targetTypes) {
        if (!name || !targetTypes) return null;
        var key = String(name).trim().toLowerCase();
        for (var i = 0; i < targetTypes.length; i++) {
            var idx = NAME_INDEX[targetTypes[i]];
            if (idx && idx[key]) return idx[key];
        }
        return null;
    }

    function renderChips(str, opts) {
        opts = opts || {};
        var chips = el('div', { class: 'chips' });
        if (!str) return chips;
        var parts = String(str).split(/;\\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
        for (var i = 0; i < parts.length; i++) {
            var part = parts[i];
            var cardId = opts.targetTypes ? resolveRefTarget(part, opts.targetTypes) : null;
            if (cardId) {
                chips.appendChild(el('a', {
                    class: 'chip accent',
                    href: '#' + cardId,
                    title: 'Jump to ' + part
                }, [part]));
            } else {
                chips.appendChild(el('span', {
                    class: 'chip' + (opts.accent ? ' accent' : '')
                }, [part]));
            }
        }
        return chips;
    }

    function renderRefs(item, refFields) {
        if (!refFields || !refFields.length) return null;
        var anyPresent = false;
        var box = el('div', { class: 'refs' });
        box.appendChild(el('div', { class: 'refs-label' }, ['Used In']));
        for (var i = 0; i < refFields.length; i++) {
            var rf = refFields[i];
            var raw = item[rf.key];
            if (!raw) continue;
            anyPresent = true;
            var row = el('div', { class: 'ref-row' });
            row.appendChild(el('b', null, [rf.label]));
            var chips = renderChips(raw, { accent: true, targetTypes: rf.targetTypes });
            row.appendChild(chips);
            box.appendChild(row);
        }
        return anyPresent ? box : null;
    }

    function renderCard(item, config, typeKey, itemIndex) {
        var id = idOf(item);
        var nm = nameOf(item);
        var cardDomId = cardIdFor(typeKey, item, itemIndex);

        var head = el('div', { class: 'card-head' });
        var title = el('h3', { class: 'card-title' });
        if (config.colorField && item[config.colorField]) {
            var sw = colorSwatch(item[config.colorField]);
            if (sw) title.appendChild(sw);
        }
        title.appendChild(document.createTextNode(nm));
        head.appendChild(title);
        if (id) head.appendChild(el('span', { class: 'card-id' }, [String(id)]));

        if (config.link) {
            var href = null;
            try { href = config.link(item); } catch (_) {}
            if (href) {
                head.appendChild(el('a', { class: 'open-in-ghl', href: href, target: '_blank', rel: 'noopener' }, ['Open in GHL ↗']));
            }
        }

        var fields = el('div', { class: 'fields' });

        // Computed fields render first (e.g. trigger link URL + Link Key)
        if (config.computedFields) {
            for (var ci = 0; ci < config.computedFields.length; ci++) {
                var cf = config.computedFields[ci];
                var val = null;
                try { val = cf.compute(item); } catch (_) { val = null; }
                if (val == null || val === '') continue;
                var cNode = fieldNode(cf.label, val, cf.valueType);
                if (cNode) fields.appendChild(cNode);
            }
        }

        var keys = (config.fields || []).concat(config.fullFields || []);
        var htmlSet = {};
        if (config.htmlFields) {
            for (var hi = 0; hi < config.htmlFields.length; hi++) htmlSet[config.htmlFields[hi]] = true;
        }
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            var vType = htmlSet[k] ? 'html' : null;
            var f = fieldNode(k, item[k], vType);
            if (f) fields.appendChild(f);
        }

        var card = el('div', { class: 'card', id: cardDomId }, [head]);
        if (fields.children.length) card.appendChild(fields);

        var refs = renderRefs(item, config.refFields);
        if (refs) card.appendChild(refs);

        // Full-data reveal
        var full = el('details', { class: 'full-data' });
        full.appendChild(el('summary', null, ['Full data']));
        var pre = el('pre');
        try { pre.textContent = JSON.stringify(item, null, 2); } catch (_) { pre.textContent = '(unserializable)'; }
        full.appendChild(pre);
        card.appendChild(full);

        // Searchable haystack
        var haystack = nm + ' ' + id + ' ';
        for (var k in item) {
            var v2 = item[k];
            if (v2 == null) continue;
            if (typeof v2 === 'string') haystack += v2 + ' ';
            else if (typeof v2 === 'number' || typeof v2 === 'boolean') haystack += String(v2) + ' ';
        }
        card.setAttribute('data-search', haystack.toLowerCase());

        return card;
    }

    function groupByFolder(items, folderField) {
        var groups = {};
        var order = [];
        for (var i = 0; i < items.length; i++) {
            var key = items[i][folderField];
            if (key == null || key === '') key = '(Unfiled)';
            if (!groups[key]) { groups[key] = []; order.push(key); }
            groups[key].push(items[i]);
        }
        order.sort(function (a, b) {
            if (a === '(Unfiled)') return 1;
            if (b === '(Unfiled)') return -1;
            return String(a).localeCompare(String(b));
        });
        return { groups: groups, order: order };
    }

    function renderSection(key, rawValue, openByDefault) {
        var config = TYPE_CONFIG[key] || { label: key };
        var items = getList(rawValue);
        if (!items.length) return null;

        var section = el('details', { class: 'section', 'data-type': key });
        if (openByDefault) section.setAttribute('open', 'open');

        var summary = el('summary');
        summary.appendChild(document.createTextNode(config.label || key));
        var count = el('span', { class: 'count' }, [String(items.length)]);
        summary.appendChild(count);
        section.appendChild(summary);

        var body = el('div', { class: 'body' });

        if (config.folderField && items.some(function (it) { return it[config.folderField]; })) {
            var grouped = groupByFolder(items, config.folderField);
            var runningIdx = 0;
            for (var i = 0; i < grouped.order.length; i++) {
                var folderName = grouped.order[i];
                var folderItems = grouped.groups[folderName];
                var folderNode = el('details', { class: 'folder-group' });
                var fSummary = el('summary');
                fSummary.appendChild(document.createTextNode(folderName));
                fSummary.appendChild(el('span', { class: 'count', style: 'margin-left:8px' }, [String(folderItems.length)]));
                folderNode.appendChild(fSummary);
                var folderBody = el('div', { class: 'items' });
                for (var j = 0; j < folderItems.length; j++) {
                    folderBody.appendChild(renderCard(folderItems[j], config, key, runningIdx++));
                }
                folderNode.appendChild(folderBody);
                body.appendChild(folderNode);
            }
        } else {
            for (var k = 0; k < items.length; k++) {
                body.appendChild(renderCard(items[k], config, key, k));
            }
        }

        section.appendChild(body);
        return section;
    }

    // Build a name -> cardId lookup across every type so ref chips rendered
    // on any card can deep-link to their referenced asset's card.
    function buildNameIndex(renderKeys) {
        for (var i = 0; i < renderKeys.length; i++) {
            var key = renderKeys[i];
            var items = getList(DATA[key]);
            if (!items.length) continue;
            var idx = NAME_INDEX[key] || (NAME_INDEX[key] = {});
            for (var j = 0; j < items.length; j++) {
                var nm = nameOf(items[j]);
                if (!nm || nm === '(unnamed)') continue;
                var k = String(nm).trim().toLowerCase();
                if (idx[k]) continue; // first occurrence wins
                idx[k] = cardIdFor(key, items[j], j);
            }
        }
    }

    // --- Build the page -----------------------------------------------------
    function counts(dataKey) {
        return getList(DATA[dataKey]).length;
    }

    function totalAssets() {
        var total = 0;
        var counted = {};
        for (var i = 0; i < TYPE_ORDER.length; i++) {
            var k = TYPE_ORDER[i];
            if (counted[k]) continue;
            counted[k] = true;
            total += counts(k);
        }
        for (var k2 in DATA) {
            if (k2.charAt(0) === '_') continue;
            if (counted[k2]) continue;
            counted[k2] = true;
            total += counts(k2);
        }
        return total;
    }

    // --- Analytics helpers --------------------------------------------------

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function formatNum(n) {
        if (typeof n !== 'number' || !isFinite(n)) return String(n || 0);
        return n.toLocaleString('en-US');
    }

    // Color palette for charts (generated from the brand accent).
    var CHART_COLORS = ['#8B5CF6', '#A78BFA', '#C4B5FD', '#6366F1', '#818CF8', '#EC4899', '#F472B6', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6', '#EF4444'];

    function buildBarChart(rows, opts) {
        // rows: [{ label, value, href? }]
        opts = opts || {};
        if (!rows || !rows.length) return '<div class="panel-empty">No data</div>';
        var max = 0;
        for (var i = 0; i < rows.length; i++) if (rows[i].value > max) max = rows[i].value;
        if (max <= 0) max = 1;
        var labelW = opts.labelW || 150;
        var valueW = 56;
        var rowH = 24;
        var pad = 4;
        var W = 560;
        var barMaxW = W - labelW - valueW - pad * 2;
        var H = rows.length * rowH + pad * 2;
        var svg = '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">';
        svg += '<defs><linearGradient id="brandGrad" x1="0" x2="1" y1="0" y2="0">'
            +  '<stop offset="0" stop-color="#8B5CF6"/><stop offset="1" stop-color="#A78BFA"/></linearGradient></defs>';
        for (var j = 0; j < rows.length; j++) {
            var r = rows[j];
            var y = pad + j * rowH;
            var w = Math.max(2, Math.round(barMaxW * (r.value / max)));
            var tY = y + rowH * 0.68;
            var labelText = r.label.length > 22 ? r.label.slice(0, 21) + '…' : r.label;
            if (r.href) {
                svg += '<a href="' + escapeHtml(r.href) + '">';
            }
            svg += '<text class="label" x="0" y="' + tY + '" font-size="12">' + escapeHtml(labelText) + '</text>';
            svg += '<rect class="bar" x="' + labelW + '" y="' + (y + 3) + '" rx="4" ry="4" width="' + w + '" height="' + (rowH - 8) + '" fill="url(#brandGrad)">'
                +  '<title>' + escapeHtml(r.label) + ': ' + formatNum(r.value) + '</title></rect>';
            svg += '<text class="value" x="' + (labelW + w + 6) + '" y="' + tY + '" font-size="12">' + formatNum(r.value) + '</text>';
            if (r.href) svg += '</a>';
        }
        svg += '</svg>';
        return svg;
    }

    function buildSegBar(segments) {
        // segments: [{label, value, color}]
        if (!segments || !segments.length) return '<div class="panel-empty">No data</div>';
        var total = 0;
        for (var i = 0; i < segments.length; i++) total += segments[i].value;
        if (total <= 0) return '<div class="panel-empty">No data</div>';
        var html = '<div class="seg-bar">';
        for (var j = 0; j < segments.length; j++) {
            var s = segments[j];
            if (!s.value) continue;
            var pct = (s.value / total * 100).toFixed(1);
            html += '<div class="seg" style="width:' + pct + '%;background:' + s.color + '" title="'
                +  escapeHtml(s.label + ': ' + s.value + ' (' + pct + '%)') + '"></div>';
        }
        html += '</div><div class="seg-legend">';
        for (var k = 0; k < segments.length; k++) {
            var sg = segments[k];
            if (!sg.value) continue;
            html += '<span class="seg-legend-item"><span class="dot" style="background:' + sg.color + '"></span>'
                +  escapeHtml(sg.label) + ' <b>' + formatNum(sg.value) + '</b></span>';
        }
        html += '</div>';
        return html;
    }

    function buildTopList(rows) {
        // rows: [{ label, value, href? }]
        if (!rows || !rows.length) return '<div class="panel-empty">None</div>';
        var html = '<div class="top-list">';
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            var label = r.href
                ? '<a href="' + escapeHtml(r.href) + '" title="' + escapeHtml(r.label) + '">' + escapeHtml(r.label) + '</a>'
                : escapeHtml(r.label);
            html += '<div class="row"><div class="nm">' + label + '</div><div class="val">' + formatNum(r.value) + '</div></div>';
        }
        html += '</div>';
        return html;
    }

    function firstCardHref(typeKey, name) {
        var idx = NAME_INDEX[typeKey];
        if (!idx || !name) return null;
        var cid = idx[String(name).trim().toLowerCase()];
        return cid ? '#' + cid : null;
    }

    function computeSummary(renderKeys) {
        var types = [];
        for (var i = 0; i < renderKeys.length; i++) {
            var k = renderKeys[i];
            var cfg = TYPE_CONFIG[k] || { label: k };
            var items = getList(DATA[k]);
            if (items.length === 0) continue;
            types.push({ key: k, label: cfg.label || k, count: items.length });
        }
        var sorted = types.slice().sort(function (a, b) { return b.count - a.count; });

        // Workflow status breakdown
        var workflows = getList(DATA.workflow);
        var wStatus = { published: 0, draft: 0, archived: 0, other: 0 };
        var wActive = 0;
        for (var w = 0; w < workflows.length; w++) {
            var st = String(workflows[w].status || '').toLowerCase();
            if (!st) wStatus.other++;
            else if (st.indexOf('publish') > -1) { wStatus.published++; wActive++; }
            else if (st.indexOf('draft') > -1) wStatus.draft++;
            else if (st.indexOf('archive') > -1) wStatus.archived++;
            else wStatus.other++;
        }

        // Custom fields by model
        var customFields = getList(DATA.custom_fields);
        var byModel = {};
        for (var f = 0; f < customFields.length; f++) {
            var m = customFields[f].model || 'other';
            byModel[m] = (byModel[m] || 0) + 1;
        }

        // Top tags
        var tags = getList(DATA.tags);
        var tagRows = [];
        for (var t = 0; t < tags.length; t++) {
            var tg = tags[t];
            var usage = (tg.totalUsage || 0) || (Number(tg.contactCount || 0) + Number(tg.opportunityCount || 0));
            if (!usage) continue;
            tagRows.push({ label: tg.name || '(unnamed)', value: usage, href: firstCardHref('tags', tg.name) });
        }
        tagRows.sort(function (a, b) { return b.value - a.value; });
        tagRows = tagRows.slice(0, 10);

        // Top trigger links (by totalReferences, fall back to clickCount)
        var links = getList(DATA.links);
        var linkRows = [];
        var orphanLinks = 0;
        for (var l = 0; l < links.length; l++) {
            var lk = links[l];
            var refs = Number(lk.totalReferences || 0);
            var clicks = Number(lk.clickCount || 0);
            var metric = refs || clicks;
            if (metric === 0) orphanLinks++;
            if (metric > 0) {
                linkRows.push({
                    label: lk.name || '(unnamed)',
                    value: metric,
                    href: firstCardHref('links', lk.name),
                    isRef: refs > 0
                });
            }
        }
        linkRows.sort(function (a, b) { return b.value - a.value; });
        linkRows = linkRows.slice(0, 10);

        // Email templates
        var emailTemplates = getList(DATA.email_templates);

        return {
            totalAssets: totalAssets(),
            typeCount: types.length,
            types: sorted,
            workflows: workflows.length,
            workflowsActive: wActive,
            workflowStatus: wStatus,
            customFields: customFields.length,
            customFieldsByModel: byModel,
            tags: tags.length,
            topTags: tagRows,
            links: links.length,
            topLinks: linkRows,
            orphanLinks: orphanLinks,
            emailTemplates: emailTemplates.length,
            forms: getList(DATA.forms).length,
            surveys: getList(DATA.surveys).length
        };
    }

    function renderOverview(pane, summary) {
        var html = '';

        // Stat cards
        html += '<div class="stat-grid">';
        html += statCard('Total Assets', summary.totalAssets, 'across ' + summary.typeCount + ' types');
        html += statCard('Workflows', summary.workflows, summary.workflowsActive + ' published');
        html += statCard('Custom Fields', summary.customFields, Object.keys(summary.customFieldsByModel).length + ' models');
        html += statCard('Tags', summary.tags, summary.topTags.length + ' in use');
        html += statCard('Trigger Links', summary.links, summary.orphanLinks + ' unreferenced');
        html += statCard('Templates', summary.emailTemplates, summary.forms + ' forms · ' + summary.surveys + ' surveys');
        html += '</div>';

        // Assets by Type (full width)
        html += '<div class="panels">';
        html += '<div class="panel full">'
            +   '<h3>Assets by Type</h3>'
            +   '<div class="panel-sub">Click any bar to jump to that section.</div>'
            +   buildBarChart(summary.types.map(function (t) {
                    return { label: t.label, value: t.count, href: '#section-' + t.key };
                }))
            +  '</div>';

        // Workflow status (half width)
        html += '<div class="panel">'
            +   '<h3>Workflow Status</h3>'
            +   '<div class="panel-sub">' + summary.workflows + ' total workflows</div>'
            +   buildSegBar([
                    { label: 'Published', value: summary.workflowStatus.published, color: '#8B5CF6' },
                    { label: 'Draft',     value: summary.workflowStatus.draft,     color: '#A78BFA' },
                    { label: 'Archived',  value: summary.workflowStatus.archived,  color: '#C4B5FD' },
                    { label: 'Other',     value: summary.workflowStatus.other,     color: '#E9D5FF' }
                ])
            +  '</div>';

        // Custom fields by model
        var cfRows = [];
        for (var m in summary.customFieldsByModel) {
            cfRows.push({ label: m, value: summary.customFieldsByModel[m] });
        }
        cfRows.sort(function (a, b) { return b.value - a.value; });
        html += '<div class="panel">'
            +   '<h3>Custom Fields by Model</h3>'
            +   '<div class="panel-sub">' + summary.customFields + ' total fields</div>'
            +   buildBarChart(cfRows, { labelW: 120 })
            +  '</div>';

        // Top tags
        html += '<div class="panel">'
            +   '<h3>Top Tags by Usage</h3>'
            +   '<div class="panel-sub">By contact + opportunity count. Click a name to jump to the tag.</div>'
            +   buildTopList(summary.topTags)
            +  '</div>';

        // Top links
        html += '<div class="panel">'
            +   '<h3>Top Trigger Links</h3>'
            +   '<div class="panel-sub">Ranked by references across workflows, emails, &amp; other assets.</div>'
            +   buildTopList(summary.topLinks)
            +  '</div>';

        html += '</div>';

        pane.innerHTML = html;
    }

    function statCard(label, value, sub) {
        return '<div class="stat-card">'
            +  '<span class="stat-label">' + escapeHtml(label) + '</span>'
            +  '<span class="stat-value">' + formatNum(value) + '</span>'
            +  '<span class="stat-sub">' + escapeHtml(sub || '') + '</span>'
            +  '</div>';
    }

    // --- Linkage / Graph ----------------------------------------------------
    // Maps every asset to a node, every cross-reference to an edge. Consumed
    // by: the Graph pane, the Overview linkage panels, and per-card edge lists.

    var LINKAGE_TYPE_META = {
        workflow:          { label: 'Workflow', color: '#8B5CF6', emoji: '⚙️' },
        workflow_trigger:  { label: 'Trigger', color: '#A855F7', emoji: '🎯' },
        tag:               { label: 'Tag', color: '#EC4899', emoji: '🏷️' },
        custom_field:      { label: 'Custom Field', color: '#10B981', emoji: '🧩' },
        custom_value:      { label: 'Custom Value', color: '#14B8A6', emoji: '🔤' },
        pipeline:          { label: 'Pipeline', color: '#F59E0B', emoji: '🪣' },
        pipeline_stage:    { label: 'Stage', color: '#FBBF24', emoji: '📍' },
        calendar:          { label: 'Calendar', color: '#3B82F6', emoji: '📅' },
        calendar_group:    { label: 'Cal Group', color: '#60A5FA', emoji: '🗂️' },
        form:              { label: 'Form', color: '#0D9488', emoji: '📝' },
        survey:            { label: 'Survey', color: '#0EA5E9', emoji: '📊' },
        email_template:    { label: 'Email', color: '#F97316', emoji: '✉️' },
        funnel:            { label: 'Funnel', color: '#EF4444', emoji: '🚀' },
        funnel_page:       { label: 'Funnel Page', color: '#F87171', emoji: '📄' },
        funnel_step:       { label: 'Funnel Step', color: '#FCA5A5', emoji: '➡️' },
        folder:            { label: 'Folder', color: '#9CA3AF', emoji: '📁' },
        media:             { label: 'Media', color: '#6366F1', emoji: '🖼️' },
        knowledge_base:    { label: 'KB', color: '#8B5CF6', emoji: '📚' },
        ai_employee:       { label: 'AI Employee', color: '#D946EF', emoji: '🤖' },
        voice_ai_agent:    { label: 'Voice Agent', color: '#C026D3', emoji: '🎙️' },
        conversation_ai:   { label: 'Convo AI', color: '#A21CAF', emoji: '💬' },
        snippet:           { label: 'Snippet', color: '#84CC16', emoji: '📎' },
        object:            { label: 'Object', color: '#65A30D', emoji: '📦' },
        link:              { label: 'Link', color: '#06B6D4', emoji: '🔗' }
    };
    function ltMeta(t) { return LINKAGE_TYPE_META[t] || { label: t, color: '#94A3B8', emoji: '•' }; }

    var EDGE_CAT_LABELS = {
        fk: 'Foreign key',
        action: 'Workflow action',
        token: 'Merge token',
        condition: 'Condition',
        form_field: 'Form field'
    };
    var EDGE_CAT_COLORS = {
        fk: '#16a34a', action: '#ea580c', token: '#2563eb',
        condition: '#c026d3', form_field: '#0d9488'
    };

    // Mirror of cardIdFor() so linkage nodes can look up rendered cards.
    function sanitizeId(id) { return String(id).replace(/[^A-Za-z0-9_-]/g, '_'); }
    function cardIdOf(collection, id) { return 'card-' + collection + '-' + sanitizeId(id); }

    function computeLinkage(D) {
        var nodes = {};          // id -> { id, type, collection, name, extra, cardId }
        var byType = {};         // type -> [id]
        var edges = [];
        var outbound = {};       // id -> [edge]
        var inbound = {};        // id -> [edge]
        var tagByName = {};
        var cfByKey = {};
        var cvByKey = {};
        var seen = {};

        function addNode(collection, type, id, name, extra) {
            if (id == null || id === '') return null;
            var key = String(id);
            if (!nodes[key]) {
                nodes[key] = {
                    id: key, type: type, collection: collection,
                    name: name || key, extra: extra || {},
                    cardId: cardIdOf(collection, key)
                };
                if (!byType[type]) byType[type] = [];
                byType[type].push(key);
            }
            return key;
        }
        function addEdge(source, target, label, category, context) {
            if (!source || !target) return;
            var s = String(source), t = String(target);
            if (s === t) return;
            if (!nodes[s] || !nodes[t]) return;
            var k = s + '|' + t + '|' + label;
            if (seen[k]) return;
            seen[k] = 1;
            var e = { source: s, target: t, label: label, category: category, context: context || null };
            edges.push(e);
            (outbound[s] = outbound[s] || []).push(e);
            (inbound[t] = inbound[t] || []).push(e);
        }
        function asIdList(v) {
            if (!v) return [];
            if (Array.isArray(v)) return v.filter(Boolean).map(String);
            if (typeof v === 'string') return v.split(/[,;\\s]+/).map(function (s) { return s.trim(); }).filter(Boolean);
            return [];
        }
        function walkStrings(obj, visit) {
            if (obj == null) return;
            if (typeof obj === 'string') { visit(obj); return; }
            if (Array.isArray(obj)) { for (var i = 0; i < obj.length; i++) walkStrings(obj[i], visit); return; }
            if (typeof obj === 'object') {
                for (var k in obj) if (obj.hasOwnProperty(k)) walkStrings(obj[k], visit);
            }
        }

        // Index nodes ---------------------------------------------------------
        var cfList = getList(D.custom_fields);
        for (var i0 = 0; i0 < cfList.length; i0++) {
            var f0 = cfList[i0];
            var id0 = addNode('custom_fields', 'custom_field', f0.id || f0._id, f0.name, {
                fieldKey: f0.fullEnrichmentData && f0.fullEnrichmentData.fieldKey,
                dataType: f0.dataType, model: f0.model,
                folderName: f0.folderName, parentId: f0.parentId
            });
            var fk0 = f0.fullEnrichmentData && f0.fullEnrichmentData.fieldKey;
            if (id0 && fk0) cfByKey[String(fk0).toLowerCase()] = id0;
        }
        var cvList = getList(D.custom_values);
        for (var i1 = 0; i1 < cvList.length; i1++) {
            var v1 = cvList[i1];
            var id1 = addNode('custom_values', 'custom_value', v1.id, v1.name, {
                fieldKey: v1.fieldKey,
                value: typeof v1.value === 'string' ? v1.value.slice(0, 120) : v1.value
            });
            var raw1 = String(v1.fieldKey || '');
            var m1 = raw1.match(/custom_values\\.([a-zA-Z0-9_]+)/);
            if (id1 && m1) cvByKey['custom_values.' + m1[1].toLowerCase()] = id1;
        }
        var tagList = getList(D.tags);
        for (var i2 = 0; i2 < tagList.length; i2++) {
            var tg2 = tagList[i2];
            var id2 = addNode('tags', 'tag', tg2.id, tg2.name, {
                contacts: tg2.contactCount, opportunities: tg2.opportunityCount
            });
            if (id2 && tg2.name) tagByName[String(tg2.name).toLowerCase().trim()] = id2;
        }
        var plList = getList(D.pipelines);
        for (var i3 = 0; i3 < plList.length; i3++) {
            addNode('pipelines', 'pipeline', plList[i3].id, plList[i3].name, { stageCount: plList[i3].stageCount });
        }
        var psList = getList(D.pipeline_stages);
        for (var i4 = 0; i4 < psList.length; i4++) {
            var ps4 = psList[i4];
            addNode('pipeline_stages', 'pipeline_stage', ps4.stageId, ps4.stageName, {
                pipelineId: ps4.pipelineId, pipelineName: ps4.pipelineName, position: ps4.stagePosition
            });
        }
        var calList = getList(D.calendars);
        for (var i5 = 0; i5 < calList.length; i5++) {
            var c5 = calList[i5];
            addNode('calendars', 'calendar', c5.id, c5.name, {
                calendarType: c5.calendarType, isActive: c5.isActive,
                slug: c5.widgetSlug, groupId: c5.groupId, formId: c5.formId
            });
        }
        var cgList = getList(D.calendar_groups);
        for (var i6 = 0; i6 < cgList.length; i6++) {
            addNode('calendar_groups', 'calendar_group', cgList[i6].id, cgList[i6].name, { slug: cgList[i6].slug });
        }
        var formList = getList(D.forms);
        for (var i7 = 0; i7 < formList.length; i7++) {
            var fr7 = formList[i7];
            addNode('forms', 'form', fr7._id || fr7.id, fr7.name, { totalFields: fr7.totalFields });
        }
        var survList = getList(D.surveys);
        for (var i8 = 0; i8 < survList.length; i8++) {
            addNode('surveys', 'survey', survList[i8]._id || survList[i8].id, survList[i8].name, {});
        }
        var wfList = getList(D.workflow);
        for (var i9 = 0; i9 < wfList.length; i9++) {
            var w9 = wfList[i9];
            addNode('workflow', 'workflow', w9.id, w9.name, {
                status: w9.status, totalSteps: w9.totalSteps,
                emailCount: w9.emailCount, smsCount: w9.smsCount
            });
        }
        var wtList = getList(D.workflow_triggers);
        for (var iA = 0; iA < wtList.length; iA++) {
            var t_A = wtList[iA];
            addNode('workflow_triggers', 'workflow_trigger', t_A.id, t_A.name, {
                workflowId: t_A.workflowId, workflowName: t_A.workflowName,
                triggerType: t_A.type, active: t_A.active
            });
        }
        var etList = getList(D.email_templates);
        for (var iB = 0; iB < etList.length; iB++) {
            addNode('email_templates', 'email_template', etList[iB].id, etList[iB].name, { templateType: etList[iB].templateType });
        }
        var fRoot = D.funnels || {};
        var funL = getList(fRoot.funnels);
        for (var iC = 0; iC < funL.length; iC++) {
            addNode('funnels', 'funnel', funL[iC]._id || funL[iC].id, funL[iC].name, {});
        }
        var funP = getList(fRoot.pages);
        for (var iD = 0; iD < funP.length; iD++) {
            var fp = funP[iD];
            addNode('funnels', 'funnel_page', fp._id || fp.id, fp.name || fp.pageName, { funnelId: fp.funnelId || fp.parentId });
        }
        var funS = getList(fRoot.steps);
        for (var iE = 0; iE < funS.length; iE++) {
            var fs = funS[iE];
            addNode('funnels', 'funnel_step', fs._id || fs.id, fs.name, { funnelId: fs.funnelId || fs.parentId });
        }
        var foL = getList(D.folders);
        for (var iF = 0; iF < foL.length; iF++) {
            var fo = foL[iF];
            addNode('folders', 'folder', fo._id || fo.id, fo.name, { parentId: fo.parentId, altType: fo.altType });
        }
        var mdL = getList(D.media);
        for (var iG = 0; iG < mdL.length; iG++) {
            var md = mdL[iG];
            addNode('media', 'media', md._id || md.id, md.name, { type: md.type, contentType: md.contentType, parentId: md.parentId });
        }
        var kbL = getList(D.knowledge_bases);
        for (var iH = 0; iH < kbL.length; iH++) {
            addNode('knowledge_bases', 'knowledge_base', kbL[iH].id, kbL[iH].name, {
                totalFiles: kbL[iH].totalFiles, totalFaqs: kbL[iH].totalFaqs
            });
        }
        var aiL = getList(D.ai_employees);
        for (var iI = 0; iI < aiL.length; iI++) {
            var ai = aiL[iI];
            addNode('ai_employees', 'ai_employee', ai.id, ai.name, {
                mode: ai.mode, botType: ai.botType, channels: ai.channels
            });
        }
        var vaL = getList(D.voice_ai_agents);
        for (var iJ = 0; iJ < vaL.length; iJ++) {
            var va = vaL[iJ];
            addNode('voice_ai_agents', 'voice_ai_agent', va._id || va.id, va.agentName, {
                status: va.agentStatus, calendarId: va.appointmentCalendarId
            });
        }
        var caL = getList(D.conversation_ai);
        for (var iK = 0; iK < caL.length; iK++) {
            addNode('conversation_ai', 'conversation_ai', caL[iK].id, caL[iK].name, { botType: caL[iK].botType });
        }
        var snL = getList(D.snippets);
        for (var iL = 0; iL < snL.length; iL++) {
            addNode('snippets', 'snippet', snL[iL].id, snL[iL].name, { type: snL[iL].type });
        }
        var obL = getList(D.objects);
        for (var iM = 0; iM < obL.length; iM++) {
            var ob = obL[iM];
            addNode('objects', 'object', ob.id, (ob.labels && (ob.labels.singular || ob.labels.plural)) || ob.key, { key: ob.key, type: ob.type });
        }
        var lkL = getList(D.links);
        for (var iN = 0; iN < lkL.length; iN++) {
            var lk = lkL[iN];
            addNode('links', 'link', lk._id || lk.id, lk.name, { shortUrl: lk.shortUrl, redirectTo: lk.redirectTo });
        }

        // Edges: foreign keys ---------------------------------------------------
        for (var iP = 0; iP < psList.length; iP++) {
            addEdge(psList[iP].stageId, psList[iP].pipelineId, 'belongs to pipeline', 'fk');
        }
        for (var iQ = 0; iQ < wtList.length; iQ++) {
            var wtQ = wtList[iQ];
            if (wtQ.workflowId) addEdge(wtQ.id, wtQ.workflowId, 'fires workflow', 'fk');
            var acts = (wtQ.fullEnrichmentData && wtQ.fullEnrichmentData.actions) || [];
            for (var iR = 0; iR < acts.length; iR++) {
                if (acts[iR].workflow_id) addEdge(wtQ.id, acts[iR].workflow_id, 'action: ' + (acts[iR].type || 'add_to_workflow'), 'fk');
            }
        }
        for (var iS = 0; iS < aiL.length; iS++) {
            var aiS = aiL[iS];
            var kbIds = asIdList(aiS.knowledgeBaseIds);
            for (var iT = 0; iT < kbIds.length; iT++) addEdge(aiS.id, kbIds[iT], 'uses knowledge base', 'fk');
            if (aiS.goalActionId && nodes[aiS.goalActionId]) addEdge(aiS.id, aiS.goalActionId, 'goal action', 'fk');
            var acIds = asIdList(aiS.actionIds);
            for (var iU = 0; iU < acIds.length; iU++) if (nodes[acIds[iU]]) addEdge(aiS.id, acIds[iU], 'configured action', 'fk');
        }
        for (var iV = 0; iV < vaL.length; iV++) {
            var vaV = vaL[iV];
            var vid = vaV._id || vaV.id;
            if (vaV.appointmentCalendarId) addEdge(vid, vaV.appointmentCalendarId, 'books appointments on', 'fk');
            var ceIds = asIdList(vaV.callEndWorkflowIds);
            for (var iW = 0; iW < ceIds.length; iW++) addEdge(vid, ceIds[iW], 'call-end workflow', 'fk');
        }
        for (var iX = 0; iX < calList.length; iX++) {
            var cX = calList[iX];
            if (cX.groupId) addEdge(cX.id, cX.groupId, 'in calendar group', 'fk');
            if (cX.formId) addEdge(cX.id, cX.formId, 'uses form', 'fk');
        }
        for (var iY = 0; iY < cfList.length; iY++) {
            if (cfList[iY].parentId) addEdge(cfList[iY].id || cfList[iY]._id, cfList[iY].parentId, 'in custom-field folder', 'fk');
        }
        for (var iZ = 0; iZ < foL.length; iZ++) {
            if (foL[iZ].parentId) addEdge(foL[iZ]._id || foL[iZ].id, foL[iZ].parentId, 'in parent folder', 'fk');
        }
        for (var i_a = 0; i_a < mdL.length; i_a++) {
            if (mdL[i_a].parentId) addEdge(mdL[i_a]._id || mdL[i_a].id, mdL[i_a].parentId, 'in folder', 'fk');
        }
        for (var i_b = 0; i_b < funP.length; i_b++) {
            var pid_b = funP[i_b].funnelId || funP[i_b].parentId;
            if (pid_b) addEdge(funP[i_b]._id || funP[i_b].id, pid_b, 'belongs to funnel', 'fk');
        }
        for (var i_c = 0; i_c < funS.length; i_c++) {
            var pid_c = funS[i_c].funnelId || funS[i_c].parentId;
            if (pid_c) addEdge(funS[i_c]._id || funS[i_c].id, pid_c, 'belongs to funnel', 'fk');
        }

        // Edges: workflow step walk --------------------------------------------
        function scanTokens(wfId, text, ctx) {
            if (!text || typeof text !== 'string') return;
            var tokRe = /\\{\\{\\s*(contact|custom_values)\\.([a-zA-Z0-9_]+)\\s*\\}\\}/g;
            var m;
            while ((m = tokRe.exec(text)) !== null) {
                var ns = m[1].toLowerCase();
                var keyLower = m[2].toLowerCase();
                if (ns === 'custom_values') {
                    var cvId = cvByKey['custom_values.' + keyLower];
                    if (cvId) addEdge(wfId, cvId, 'references custom value in "' + ctx.stepName + '"', 'token', ctx);
                } else {
                    var cfId = cfByKey['contact.' + keyLower];
                    if (cfId) addEdge(wfId, cfId, 'references custom field in "' + ctx.stepName + '"', 'token', ctx);
                    var rawId = m[2];
                    if (nodes[rawId] && nodes[rawId].type === 'custom_field') {
                        addEdge(wfId, rawId, 'references custom field in "' + ctx.stepName + '"', 'token', ctx);
                    }
                }
            }
        }
        function scanStep(wfId, step) {
            var stepName = step.name || step.type || 'step';
            var ctx = { stepId: step.id, stepName: stepName, stepType: step.type };
            var attrs = step.attributes || {};
            switch (step.type) {
                case 'add_contact_tag':
                case 'remove_contact_tag':
                    if (attrs.tags) for (var iTg = 0; iTg < attrs.tags.length; iTg++) {
                        var tagId = tagByName[String(attrs.tags[iTg]).toLowerCase().trim()];
                        if (tagId) addEdge(wfId, tagId, (step.type === 'add_contact_tag' ? 'adds' : 'removes') + ' tag in "' + stepName + '"', 'action', ctx);
                    }
                    break;
                case 'create_opportunity':
                case 'internal_create_opportunity':
                    if (attrs.pipeline_id) addEdge(wfId, attrs.pipeline_id, 'creates opportunity in pipeline', 'action', ctx);
                    if (attrs.pipeline_stage_id) addEdge(wfId, attrs.pipeline_stage_id, 'creates opportunity at stage', 'action', ctx);
                    break;
                case 'internal_update_opportunity':
                    if (attrs.pipeline_id) addEdge(wfId, attrs.pipeline_id, 'updates opportunity pipeline', 'action', ctx);
                    if (attrs.pipeline_stage_id) addEdge(wfId, attrs.pipeline_stage_id, 'moves to stage', 'action', ctx);
                    break;
                case 'remove_opportunity':
                    if (attrs.pipeline_id) addEdge(wfId, attrs.pipeline_id, 'removes opportunity from pipeline', 'action', ctx);
                    break;
                case 'update_contact_field':
                    if (attrs.fields) for (var iFd = 0; iFd < attrs.fields.length; iFd++) {
                        if (attrs.fields[iFd].field) addEdge(wfId, attrs.fields[iFd].field, 'updates custom field "' + (attrs.fields[iFd].title || '') + '"', 'action', ctx);
                    }
                    break;
                case 'add_to_workflow':
                    if (attrs.workflow_id) addEdge(wfId, attrs.workflow_id, 'add_to_workflow in "' + stepName + '"', 'action', ctx);
                    break;
                case 'remove_from_workflow':
                    if (attrs.workflow_id) addEdge(wfId, attrs.workflow_id, 'remove_from_workflow in "' + stepName + '"', 'action', ctx);
                    break;
                case 'if_else':
                    var branches = attrs.branches || [];
                    for (var iBr = 0; iBr < branches.length; iBr++) {
                        var br = branches[iBr];
                        var segs = br.segments || [];
                        for (var iSg = 0; iSg < segs.length; iSg++) {
                            var conds = segs[iSg].conditions || [];
                            for (var iCd = 0; iCd < conds.length; iCd++) {
                                var c = conds[iCd];
                                if (c.conditionSubType === 'tags' && Array.isArray(c.conditionValue)) {
                                    for (var iVl = 0; iVl < c.conditionValue.length; iVl++) {
                                        var tid = tagByName[String(c.conditionValue[iVl]).toLowerCase().trim()];
                                        if (tid) addEdge(wfId, tid, 'if/else branch "' + br.name + '" matches tag', 'condition', ctx);
                                    }
                                }
                                var fld = c.field || c.customFieldId || c.fieldId;
                                if (fld && nodes[fld] && nodes[fld].type === 'custom_field') {
                                    addEdge(wfId, fld, 'if/else branch "' + br.name + '" checks custom field', 'condition', ctx);
                                }
                            }
                        }
                    }
                    break;
            }
            walkStrings(attrs, function (s) { scanTokens(wfId, s, ctx); });
            // Generic fallback: any string in step attrs that IS a known node id
            walkStrings(attrs, function (s) {
                if (typeof s !== 'string') return;
                if (s.length < 12 || s.length > 48) return;
                if (!/^[A-Za-z0-9_-]+$/.test(s)) return;
                if (!nodes[s] || s === wfId) return;
                var tn = nodes[s];
                if (tn.type === 'tag' || tn.type === 'custom_field' || tn.type === 'custom_value') return;
                addEdge(wfId, s, tn.type + ' referenced in "' + stepName + '"', 'action', ctx);
            });
        }
        for (var iWf = 0; iWf < wfList.length; iWf++) {
            var wW = wfList[iWf];
            var tmpl = (wW.fullEnrichmentData && wW.fullEnrichmentData.workflowData && wW.fullEnrichmentData.workflowData.templates) || [];
            for (var iTm = 0; iTm < tmpl.length; iTm++) scanStep(wW.id, tmpl[iTm]);
        }

        // Edges: trigger conditions --------------------------------------------
        for (var iWt = 0; iWt < wtList.length; iWt++) {
            var tWt = wtList[iWt];
            var condsWt = (tWt.fullEnrichmentData && (tWt.fullEnrichmentData.filters || tWt.fullEnrichmentData.conditions)) || [];
            var ctxWt = { stepId: tWt.id, stepName: tWt.name, stepType: 'trigger' };
            walkStrings(condsWt, function (str) {
                var re = /(?:^|[^a-zA-Z0-9_])(contact|custom_values)\\.([a-zA-Z0-9_]+)/g;
                var m;
                while ((m = re.exec(str)) !== null) {
                    var ns = m[1].toLowerCase();
                    var key = m[2];
                    if (ns === 'custom_values') {
                        var cvId = cvByKey['custom_values.' + key.toLowerCase()];
                        if (cvId) addEdge(tWt.id, cvId, 'trigger references custom value', 'condition', ctxWt);
                    } else {
                        var cfId = cfByKey['contact.' + key.toLowerCase()];
                        if (cfId) addEdge(tWt.id, cfId, 'trigger references custom field', 'condition', ctxWt);
                        if (nodes[key] && nodes[key].type === 'custom_field') {
                            addEdge(tWt.id, key, 'trigger references custom field', 'condition', ctxWt);
                        }
                    }
                }
            });
            walkStrings(condsWt, function (str) {
                var v = String(str).toLowerCase().trim();
                if (tagByName[v]) addEdge(tWt.id, tagByName[v], 'trigger condition on tag', 'condition', ctxWt);
            });
        }

        // Edges: form field -> custom field ------------------------------------
        for (var iFm = 0; iFm < formList.length; iFm++) {
            var fm = formList[iFm];
            var fields = (fm.fullEnrichmentData && fm.fullEnrichmentData.formData && fm.fullEnrichmentData.formData.form && fm.fullEnrichmentData.formData.form.fields) || [];
            for (var iFl = 0; iFl < fields.length; iFl++) {
                var fld = fields[iFl];
                var tag = fld && fld.tag;
                if (tag && nodes[tag] && nodes[tag].type === 'custom_field') {
                    var lblPrev = typeof fld.label === 'string' ? fld.label.replace(/<[^>]+>/g, '').slice(0, 60) : '';
                    addEdge(fm._id || fm.id, tag, 'collects custom field' + (lblPrev ? ' ("' + lblPrev + '")' : ''), 'form_field');
                }
            }
        }

        // Edges: survey / email token scan -------------------------------------
        for (var iSu = 0; iSu < survList.length; iSu++) {
            var sU = survList[iSu];
            var sId = sU._id || sU.id;
            var sRoot = sU.fullEnrichmentData || sU;
            walkStrings(sRoot, function (str) { scanTokens(sId, str, { stepId: sId, stepName: sU.name || 'survey', stepType: 'survey' }); });
        }
        for (var iEt = 0; iEt < etList.length; iEt++) {
            var eT = etList[iEt];
            walkStrings(eT, function (str) { scanTokens(eT.id, str, { stepId: eT.id, stepName: eT.name || 'email_template', stepType: 'email_template' }); });
        }

        // Stats + analytics ----------------------------------------------------
        var edgesByCategory = {};
        for (var iEc = 0; iEc < edges.length; iEc++) {
            edgesByCategory[edges[iEc].category] = (edgesByCategory[edges[iEc].category] || 0) + 1;
        }
        var orphanIds = [];
        var nodesList = [];
        for (var nId in nodes) {
            nodesList.push(nodes[nId]);
            if (!outbound[nId] && !inbound[nId]) orphanIds.push(nId);
        }
        var connectedCount = nodesList.length - orphanIds.length;
        var orphansByType = {};
        for (var iO = 0; iO < orphanIds.length; iO++) {
            var ot = nodes[orphanIds[iO]].type;
            orphansByType[ot] = (orphansByType[ot] || 0) + 1;
        }
        function degree(id) { return ((outbound[id] || []).length) + ((inbound[id] || []).length); }
        var topNodes = nodesList.map(function (n) { return { n: n, d: degree(n.id) }; })
            .filter(function (x) { return x.d > 0; })
            .sort(function (a, b) { return b.d - a.d; })
            .slice(0, 20);
        function unref(type) {
            var out = [];
            var ids = byType[type] || [];
            for (var i = 0; i < ids.length; i++) if (!inbound[ids[i]]) out.push(nodes[ids[i]]);
            return out;
        }
        function hotBy(type, limit) {
            var ids = byType[type] || [];
            var rows = [];
            for (var i = 0; i < ids.length; i++) {
                var c = (inbound[ids[i]] || []).length;
                if (c > 0) rows.push({ n: nodes[ids[i]], c: c });
            }
            rows.sort(function (a, b) { return b.c - a.c; });
            return rows.slice(0, limit || 10);
        }
        var analytics = {
            topNodes: topNodes,
            hotTags: hotBy('tag', 10),
            hotCustomFields: hotBy('custom_field', 10),
            deadTags: unref('tag'),
            deadCustomFields: unref('custom_field'),
            deadEmailTemplates: unref('email_template'),
            orphansByType: orphansByType
        };
        return {
            nodes: nodes, nodesList: nodesList, byType: byType, edges: edges,
            outbound: outbound, inbound: inbound,
            stats: {
                totalNodes: nodesList.length, totalEdges: edges.length,
                edgesByCategory: edgesByCategory, orphanCount: orphanIds.length,
                connectedCount: connectedCount, orphanIds: orphanIds
            },
            analytics: analytics
        };
    }

    // --- Overview enhancement ------------------------------------------------
    // Cleanup-driven linkage overview — replaces the prior 7-panel wall of
    // charts with a single "Needs attention" row plus one combined "Most
    // referenced" list. Detail lists for unreferenced assets are tucked into
    // a collapsible <details>.
    function renderLinkageOverview(pane, L) {
        var S = L.stats;
        var A = L.analytics;

        // Compact metric strip
        var strip = document.createElement('div');
        strip.className = 'linkage-strip';
        strip.innerHTML =
            pill('Linkage edges', S.totalEdges) +
            pill('Connected', S.connectedCount) +
            pill('Orphans', S.orphanCount);
        pane.appendChild(strip);

        // Attention callouts (clickable jumps to the relevant section)
        var attnRow = [
            { num: S.orphanCount, lab: 'orphan assets', emoji: '🪦', cls: 'danger' },
            { num: A.deadTags.length, lab: 'unused tags', emoji: '🏷️', cls: 'warn' },
            { num: A.deadCustomFields.length, lab: 'unused custom fields', emoji: '🧩', cls: 'warn' },
            { num: A.deadEmailTemplates.length, lab: 'unused email templates', emoji: '✉️', cls: 'warn' },
        ].filter(function (a) { return a.num > 0; });

        if (attnRow.length) {
            var attnGrid = document.createElement('div');
            attnGrid.className = 'attn-cards';
            attnGrid.innerHTML = '<h3 class="attn-h">Needs attention</h3>'
                + '<div class="attn-grid">'
                + attnRow.map(function (a) {
                    return '<div class="attn-card ' + a.cls + '">'
                        + '<span class="ac-icon">' + a.emoji + '</span>'
                        + '<div><div class="ac-num">' + formatNum(a.num) + '</div>'
                        + '<div class="ac-lab">' + escapeHtml(a.lab) + '</div></div>'
                        + '</div>';
                }).join('')
                + '</div>';
            pane.appendChild(attnGrid);
        }

        // Single "Most referenced" panel — combines top-connected nodes with
        // the highest-degree tags/fields, sorted by reference count.
        var hotCombined = []
            .concat(A.topNodes.map(function (x) { return { name: x.n.name, refs: x.d, href: '#' + x.n.cardId, type: x.n.type }; }))
            .sort(function (a, b) { return b.refs - a.refs; })
            .slice(0, 10);

        var panels = document.createElement('div');
        panels.className = 'panels';
        panels.innerHTML = panel(
            'Most referenced assets',
            'The hubs of your account — changes here have the widest blast radius.',
            topList(hotCombined.map(function (r) {
                return { label: r.name, value: r.refs, href: r.href, emoji: ltMeta(r.type).emoji, sub: ltMeta(r.type).label.replace(/s$/, '') };
            }))
        );
        pane.appendChild(panels);

        // Collapsible cleanup lists — out of the way unless you want them
        if (A.deadTags.length || A.deadCustomFields.length || A.deadEmailTemplates.length) {
            var cleanup = document.createElement('details');
            cleanup.className = 'cleanup-details';
            cleanup.innerHTML = '<summary>🗑️ Cleanup candidates · '
                + (A.deadTags.length + A.deadCustomFields.length + A.deadEmailTemplates.length)
                + ' unreferenced</summary>'
                + '<div class="panels">'
                + (A.deadTags.length ? panel('Tags', '', topList(A.deadTags.slice(0, 20).map(function (n) {
                    return { label: n.name, value: 0, href: '#' + n.cardId, emoji: '🏷️' };
                }))) : '')
                + (A.deadCustomFields.length ? panel('Custom fields', '', topList(A.deadCustomFields.slice(0, 20).map(function (n) {
                    return { label: n.name, value: 0, href: '#' + n.cardId, emoji: '🧩' };
                }))) : '')
                + (A.deadEmailTemplates.length ? panel('Email templates', '', topList(A.deadEmailTemplates.slice(0, 15).map(function (n) {
                    return { label: n.name, value: 0, href: '#' + n.cardId, emoji: '✉️' };
                }))) : '')
                + '</div>';
            pane.appendChild(cleanup);
        }

        function pill(k, v) {
            return '<div class="linkage-pill"><span class="k">' + escapeHtml(k) + '</span><span class="v">' + formatNum(v) + '</span></div>';
        }
        function panel(title, sub, body) {
            return '<div class="panel"><h3>' + escapeHtml(title) + '</h3>'
                + (sub ? '<div class="panel-sub">' + escapeHtml(sub) + '</div>' : '')
                + body + '</div>';
        }
        function topList(rows) {
            if (!rows.length) return '<p class="panel-empty">No data.</p>';
            var out = '<div class="top-list">';
            for (var i = 0; i < rows.length; i++) {
                var r = rows[i];
                out += '<div class="row"><a href="' + escapeHtml(r.href || '#') + '"><span class="nm">' + (r.emoji ? r.emoji + ' ' : '') + escapeHtml(r.label) + (r.sub ? ' <span style="color:var(--muted);font-size:11px">· ' + escapeHtml(r.sub) + '</span>' : '') + '</span></a>' + (r.value ? '<span class="val">' + formatNum(r.value) + '</span>' : '') + '</div>';
            }
            return out + '</div>';
        }
    }

    // --- Per-card edge enrichment --------------------------------------------
    function enrichCardsWithEdges(L) {
        var MAX_INLINE = 6; // show this many initially, hide the rest behind "show more"
        for (var id in L.nodes) {
            var n = L.nodes[id];
            var card = document.getElementById(n.cardId);
            if (!card) continue;
            var outs = L.outbound[id] || [];
            var ins = L.inbound[id] || [];

            // Header: insert degree pill + graph-focus button into the head row
            var head = card.querySelector('.card-head');
            if (head) {
                var pill = document.createElement('span');
                pill.className = 'degree-pill';
                pill.title = 'outbound · inbound';
                pill.innerHTML = '<span class="o">↗ ' + outs.length + '</span> · <span class="i">↙ ' + ins.length + '</span>';
                head.appendChild(pill);
                var gbtn = document.createElement('button');
                gbtn.className = 'graph-btn-mini';
                gbtn.type = 'button';
                gbtn.title = 'Center in graph';
                gbtn.textContent = '◎';
                gbtn.setAttribute('data-focus', id);
                head.appendChild(gbtn);
            }

            // Body: append refs-edges block
            if (outs.length === 0 && ins.length === 0) continue;
            var box = document.createElement('div');
            box.className = 'refs-edges';
            box.appendChild(edgeCol('Uses', 'out', outs));
            box.appendChild(edgeCol('Used by', 'in', ins));
            card.appendChild(box);
        }
        // Delegated click handler for graph-focus buttons
        document.addEventListener('click', function (e) {
            var b = e.target.closest ? e.target.closest('.graph-btn-mini[data-focus]') : null;
            if (!b) return;
            var nid = b.getAttribute('data-focus');
            setView('graph');
            setTimeout(function () { if (typeof focusGraphNode === 'function') focusGraphNode(nid); }, 40);
        });

        function edgeCol(title, direction, list) {
            var col = document.createElement('section');
            col.className = 'edges-col';
            var h = document.createElement('h5');
            h.innerHTML = escapeHtml(title) + (list.length ? ' <span class="cnt">' + list.length + '</span>' : '');
            col.appendChild(h);
            if (!list.length) {
                var p = document.createElement('p');
                p.className = 'panel-empty';
                p.textContent = 'None.';
                col.appendChild(p);
                return col;
            }
            var ul = document.createElement('ul');
            var initial = Math.min(MAX_INLINE, list.length);
            for (var i = 0; i < initial; i++) ul.appendChild(edgeRow(list[i], direction));
            col.appendChild(ul);
            if (list.length > initial) {
                var hiddenUl = document.createElement('ul');
                hiddenUl.style.display = 'none';
                for (var j = initial; j < list.length; j++) hiddenUl.appendChild(edgeRow(list[j], direction));
                var btn = document.createElement('button');
                btn.className = 'more-btn';
                btn.type = 'button';
                btn.textContent = '+ show ' + (list.length - initial) + ' more';
                btn.addEventListener('click', function () {
                    var show = hiddenUl.style.display === 'none';
                    hiddenUl.style.display = show ? '' : 'none';
                    btn.textContent = show ? '– hide' : '+ show ' + (list.length - initial) + ' more';
                });
                col.appendChild(hiddenUl);
                col.appendChild(btn);
            }
            return col;
        }
        function edgeRow(e, direction) {
            var otherId = direction === 'out' ? e.target : e.source;
            var other = L.nodes[otherId];
            var arrow = direction === 'out' ? '→' : '←';
            var li = document.createElement('li');
            li.className = 'edge-' + e.category;
            var arr = document.createElement('span');
            arr.className = 'arr'; arr.textContent = arrow;
            li.appendChild(arr);
            var lbl = document.createElement('span');
            lbl.className = 'lbl'; lbl.textContent = e.label;
            li.appendChild(lbl);
            if (e.context && e.context.stepName && e.context.stepName !== e.label) {
                var ctx = document.createElement('span');
                ctx.className = 'ctx';
                ctx.textContent = '(' + (e.context.stepType || '') + (e.context.stepName !== e.context.stepType ? ': ' + e.context.stepName : '') + ')';
                li.appendChild(ctx);
            }
            if (other) {
                var chip = document.createElement('a');
                chip.className = 'ref-chip';
                chip.href = '#' + other.cardId;
                chip.title = other.name;
                chip.innerHTML = ltMeta(other.type).emoji + ' ' + escapeHtml(other.name) + ' <span class="rk">' + escapeHtml(ltMeta(other.type).label) + '</span>';
                li.appendChild(chip);
            }
            return li;
        }
    }

    // --- Graph view ----------------------------------------------------------
    var GRAPH_RENDERED = false;
    var GRAPH_STATE = null; // { svg, viewport, canvas, nodeEls, edgeEls, nodeIndex, layout }

    function ensureGraphRendered() {
        if (GRAPH_RENDERED || !window.__LINKAGE__) return;
        GRAPH_RENDERED = true;
        var pane = document.getElementById('pane-graph');
        if (!pane) return;
        // Render shell immediately with a loader
        pane.innerHTML = buildGraphShell(window.__LINKAGE__);
        wireGraphFilters();
        var loader = document.createElement('div');
        loader.className = 'graph-loader';
        loader.textContent = 'Computing force-directed layout…';
        var canvas = document.getElementById('graph-canvas');
        if (canvas) canvas.appendChild(loader);
        // Yield to browser so the loader paints, then compute layout
        setTimeout(function () {
            computeAndRenderGraphSvg(window.__LINKAGE__);
            if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
            wireGraphInteractivity();
        }, 30);
    }

    function buildGraphShell(L) {
        var typesSorted = Object.keys(L.byType).sort(function (a, b) {
            return (L.byType[b].length) - (L.byType[a].length);
        });
        var typeLegend = '';
        for (var i = 0; i < typesSorted.length; i++) {
            var t = typesSorted[i];
            var m = ltMeta(t);
            typeLegend += '<label class="glegend-item">'
                + '<input type="checkbox" class="gfilter-type" value="' + escapeHtml(t) + '" checked>'
                + '<span class="swatch" style="background:' + m.color + '"></span>'
                + '<span>' + m.emoji + ' ' + escapeHtml(m.label) + '</span>'
                + '<span class="cnt">' + L.byType[t].length + '</span>'
                + '</label>';
        }
        var catLegend = '';
        for (var c in L.stats.edgesByCategory) {
            catLegend += '<label class="glegend-item">'
                + '<input type="checkbox" class="gfilter-cat" value="' + escapeHtml(c) + '" checked>'
                + '<span class="swatch" style="background:' + EDGE_CAT_COLORS[c] + '"></span>'
                + '<span>' + escapeHtml(EDGE_CAT_LABELS[c] || c) + '</span>'
                + '<span class="cnt">' + L.stats.edgesByCategory[c] + '</span>'
                + '</label>';
        }
        return ''
            + '<div class="graph-shell">'
            + '  <div class="graph-sidebar">'
            + '    <div class="graph-filter-block">'
            + '      <div class="graph-filter-head"><h4>Node types</h4>'
            + '        <div><button type="button" class="graph-mini-btn" data-toggle-types="all">All</button><button type="button" class="graph-mini-btn" data-toggle-types="none">None</button></div>'
            + '      </div>'
            + '      <div class="glegend">' + typeLegend + '</div>'
            + '    </div>'
            + '    <div class="graph-filter-block">'
            + '      <div class="graph-filter-head"><h4>Edge categories</h4>'
            + '        <div><button type="button" class="graph-mini-btn" data-toggle-cats="all">All</button><button type="button" class="graph-mini-btn" data-toggle-cats="none">None</button></div>'
            + '      </div>'
            + '      <div class="glegend">' + catLegend + '</div>'
            + '    </div>'
            + '    <div class="graph-filter-block">'
            + '      <div class="graph-filter-head"><h4>Display</h4></div>'
            + '      <label class="glegend-item"><input type="checkbox" id="gfilter-orphans" checked> <span>Show orphans</span></label>'
            + '    </div>'
            + '    <div class="graph-filter-block">'
            + '      <div class="graph-filter-head"><h4>Selected</h4></div>'
            + '      <div id="graph-selected-info" class="graph-selected-info"><p class="panel-empty">Click a node to inspect.</p></div>'
            + '    </div>'
            + '  </div>'
            + '  <div class="graph-canvas-wrap">'
            + '    <div class="graph-toolbar">'
            + '      <div class="graph-search-wrap"><input id="graph-search" type="search" placeholder="Find node by name…" autocomplete="off"></div>'
            + '      <button type="button" class="graph-mini-btn" id="graph-reset">Reset view</button>'
            + '      <span class="graph-hint">Drag to pan · scroll to zoom · click node to focus</span>'
            + '    </div>'
            + '    <div class="graph-canvas" id="graph-canvas"></div>'
            + '  </div>'
            + '</div>';
    }

    function computeAndRenderGraphSvg(L) {
        var W = 1600, H = 1100, CX = W / 2, CY = H / 2;
        var area = W * H;
        var nodesArr = L.nodesList;
        var n = nodesArr.length;
        if (!n) return;
        var k = Math.sqrt(area / Math.max(1, n));
        var pos = {};

        // Seed by type cluster
        var types = Object.keys(L.byType);
        for (var i = 0; i < nodesArr.length; i++) {
            var nd = nodesArr[i];
            var ti = types.indexOf(nd.type);
            var baseAngle = (ti / Math.max(1, types.length)) * Math.PI * 2;
            var radius = 200 + (ti % 3) * 60;
            var jitter = ((i * 37) % 80);
            var subAngle = baseAngle + ((i % 40) - 20) * 0.06;
            pos[nd.id] = {
                x: CX + Math.cos(subAngle) * (radius + jitter),
                y: CY + Math.sin(subAngle) * (radius + jitter)
            };
        }
        // Push orphans to outer ring
        for (var iOr = 0; iOr < L.stats.orphanIds.length; iOr++) {
            var oid = L.stats.orphanIds[iOr];
            var aOr = (iOr / Math.max(1, L.stats.orphanIds.length)) * Math.PI * 2;
            pos[oid] = { x: CX + Math.cos(aOr) * 700, y: CY + Math.sin(aOr) * 480 };
        }
        // Connected subgraph for FR
        var connected = [];
        for (var iC = 0; iC < nodesArr.length; iC++) {
            var cid = nodesArr[iC].id;
            if (L.outbound[cid] || L.inbound[cid]) connected.push(cid);
        }
        var edgesArr = L.edges;
        var iterations = connected.length > 400 ? 50 : 90;
        var temp = Math.min(W, H) / 8;
        var cooling = Math.pow(0.02, 1 / iterations);
        var minD = 4;
        var disp = {};
        for (var iFr = 0; iFr < iterations; iFr++) {
            for (var iDz = 0; iDz < connected.length; iDz++) disp[connected[iDz]] = { x: 0, y: 0 };
            // Repulsion
            for (var a = 0; a < connected.length; a++) {
                var pa = pos[connected[a]];
                var da = disp[connected[a]];
                for (var b = a + 1; b < connected.length; b++) {
                    var pb = pos[connected[b]];
                    var db = disp[connected[b]];
                    var dx = pa.x - pb.x;
                    var dy = pa.y - pb.y;
                    var d = Math.sqrt(dx * dx + dy * dy);
                    if (d < minD) d = minD;
                    var f = (k * k) / d;
                    var ux = dx / d, uy = dy / d;
                    da.x += ux * f; da.y += uy * f;
                    db.x -= ux * f; db.y -= uy * f;
                }
            }
            // Attraction
            for (var iE = 0; iE < edgesArr.length; iE++) {
                var e = edgesArr[iE];
                var ps = pos[e.source], pt = pos[e.target];
                if (!ps || !pt) continue;
                if (!disp[e.source] || !disp[e.target]) continue;
                var edx = ps.x - pt.x, edy = ps.y - pt.y;
                var ed = Math.sqrt(edx * edx + edy * edy);
                if (ed < minD) ed = minD;
                var ef = (ed * ed) / k;
                var eux = edx / ed, euy = edy / ed;
                disp[e.source].x -= eux * ef; disp[e.source].y -= euy * ef;
                disp[e.target].x += eux * ef; disp[e.target].y += euy * ef;
            }
            // Gravity + displacement
            for (var iDx = 0; iDx < connected.length; iDx++) {
                var ccid = connected[iDx];
                var pc = pos[ccid], dcp = disp[ccid];
                dcp.x += (CX - pc.x) * 0.005;
                dcp.y += (CY - pc.y) * 0.005;
                var mm = Math.sqrt(dcp.x * dcp.x + dcp.y * dcp.y);
                if (mm < 0.001) continue;
                var lim = Math.min(mm, temp);
                pc.x += (dcp.x / mm) * lim;
                pc.y += (dcp.y / mm) * lim;
                if (pc.x < 40) pc.x = 40; else if (pc.x > W - 40) pc.x = W - 40;
                if (pc.y < 40) pc.y = 40; else if (pc.y > H - 40) pc.y = H - 40;
            }
            temp *= cooling;
        }

        // Build SVG
        var svgNS = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(svgNS, 'svg');
        svg.id = 'graph-svg';
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        var viewport = document.createElementNS(svgNS, 'g');
        viewport.id = 'graph-viewport';
        svg.appendChild(viewport);
        var gEdges = document.createElementNS(svgNS, 'g');
        gEdges.id = 'graph-edges';
        var gNodes = document.createElementNS(svgNS, 'g');
        gNodes.id = 'graph-nodes';
        viewport.appendChild(gEdges);
        viewport.appendChild(gNodes);

        var edgeEls = [];
        for (var iEdraw = 0; iEdraw < edgesArr.length; iEdraw++) {
            var ee = edgesArr[iEdraw];
            var eps = pos[ee.source], ept = pos[ee.target];
            if (!eps || !ept) continue;
            var ln = document.createElementNS(svgNS, 'line');
            ln.setAttribute('class', 'gedge');
            ln.setAttribute('data-category', ee.category);
            ln.setAttribute('data-source', ee.source);
            ln.setAttribute('data-target', ee.target);
            ln.setAttribute('x1', eps.x.toFixed(1));
            ln.setAttribute('y1', eps.y.toFixed(1));
            ln.setAttribute('x2', ept.x.toFixed(1));
            ln.setAttribute('y2', ept.y.toFixed(1));
            ln.style.stroke = EDGE_CAT_COLORS[ee.category] || '#888';
            gEdges.appendChild(ln);
            edgeEls.push(ln);
        }
        var nodeEls = [];
        var nodeIndex = {};
        function degreeOf(id) { return ((L.outbound[id] || []).length) + ((L.inbound[id] || []).length); }
        for (var iNdraw = 0; iNdraw < nodesArr.length; iNdraw++) {
            var nd2 = nodesArr[iNdraw];
            var p = pos[nd2.id];
            if (!p) continue;
            var deg = degreeOf(nd2.id);
            var r = 4 + Math.min(12, Math.sqrt(deg) * 1.8);
            var g = document.createElementNS(svgNS, 'g');
            g.setAttribute('class', 'gnode');
            g.setAttribute('data-id', nd2.id);
            g.setAttribute('data-type', nd2.type);
            g.setAttribute('data-name', String(nd2.name || '').toLowerCase());
            g.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ')');
            if (deg === 0) g.setAttribute('data-orphan', '1');
            var circle = document.createElementNS(svgNS, 'circle');
            circle.setAttribute('r', r.toFixed(1));
            circle.setAttribute('fill', ltMeta(nd2.type).color);
            circle.setAttribute('stroke', '#fff');
            circle.setAttribute('stroke-width', '1.5');
            var title = document.createElementNS(svgNS, 'title');
            title.textContent = nd2.name + ' — ' + ltMeta(nd2.type).label + ' (deg ' + deg + ')';
            g.appendChild(circle);
            g.appendChild(title);
            gNodes.appendChild(g);
            nodeEls.push(g);
            nodeIndex[nd2.id] = g;
        }

        var canvas = document.getElementById('graph-canvas');
        canvas.appendChild(svg);
        GRAPH_STATE = {
            svg: svg, viewport: viewport, canvas: canvas,
            nodeEls: nodeEls, edgeEls: edgeEls, nodeIndex: nodeIndex,
            vx: 0, vy: 0, vs: 1, selectedId: null, layout: { W: W, H: H, pos: pos }
        };
    }

    function wireGraphFilters() {
        document.querySelectorAll('.gfilter-type').forEach(function (c) { c.addEventListener('change', applyTypeFilters); });
        document.querySelectorAll('.gfilter-cat').forEach(function (c) { c.addEventListener('change', applyCategoryFilters); });
        document.querySelectorAll('[data-toggle-types]').forEach(function (b) {
            b.addEventListener('click', function () {
                var all = b.getAttribute('data-toggle-types') === 'all';
                document.querySelectorAll('.gfilter-type').forEach(function (c) { c.checked = all; });
                applyTypeFilters();
            });
        });
        document.querySelectorAll('[data-toggle-cats]').forEach(function (b) {
            b.addEventListener('click', function () {
                var all = b.getAttribute('data-toggle-cats') === 'all';
                document.querySelectorAll('.gfilter-cat').forEach(function (c) { c.checked = all; });
                applyCategoryFilters();
            });
        });
        var oToggle = document.getElementById('gfilter-orphans');
        if (oToggle) oToggle.addEventListener('change', function (e) {
            if (!GRAPH_STATE) return;
            GRAPH_STATE.nodeEls.forEach(function (g) {
                g.classList.toggle('hide-by-orphan', !e.target.checked && g.getAttribute('data-orphan') === '1');
            });
        });
        var resetBtn = document.getElementById('graph-reset');
        if (resetBtn) resetBtn.addEventListener('click', function () { if (GRAPH_STATE) { GRAPH_STATE.vx = 0; GRAPH_STATE.vy = 0; GRAPH_STATE.vs = 1; applyGraphTransform(); } });
    }

    function applyTypeFilters() {
        if (!GRAPH_STATE) return;
        var shown = {};
        document.querySelectorAll('.gfilter-type').forEach(function (c) { shown[c.value] = c.checked; });
        GRAPH_STATE.nodeEls.forEach(function (g) { g.classList.toggle('hide-by-type', !shown[g.getAttribute('data-type')]); });
        GRAPH_STATE.edgeEls.forEach(function (e) {
            var s = GRAPH_STATE.nodeIndex[e.getAttribute('data-source')];
            var t = GRAPH_STATE.nodeIndex[e.getAttribute('data-target')];
            var hide = (s && s.classList.contains('hide-by-type')) || (t && t.classList.contains('hide-by-type'));
            e.classList.toggle('hide-by-type', !!hide);
        });
    }
    function applyCategoryFilters() {
        if (!GRAPH_STATE) return;
        var shown = {};
        document.querySelectorAll('.gfilter-cat').forEach(function (c) { shown[c.value] = c.checked; });
        GRAPH_STATE.edgeEls.forEach(function (e) { e.classList.toggle('hide-by-cat', !shown[e.getAttribute('data-category')]); });
    }
    function applyGraphTransform() {
        if (!GRAPH_STATE) return;
        GRAPH_STATE.viewport.setAttribute('transform', 'translate(' + GRAPH_STATE.vx + ',' + GRAPH_STATE.vy + ') scale(' + GRAPH_STATE.vs + ')');
    }

    function wireGraphInteractivity() {
        if (!GRAPH_STATE) return;
        var s = GRAPH_STATE;
        var dragging = null;
        s.canvas.addEventListener('mousedown', function (e) {
            if (e.target.closest && e.target.closest('.gnode')) return;
            dragging = { x: e.clientX, y: e.clientY, vx: s.vx, vy: s.vy };
            s.canvas.classList.add('dragging');
        });
        window.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            s.vx = dragging.vx + (e.clientX - dragging.x);
            s.vy = dragging.vy + (e.clientY - dragging.y);
            applyGraphTransform();
        });
        window.addEventListener('mouseup', function () {
            dragging = null;
            s.canvas.classList.remove('dragging');
        });
        s.canvas.addEventListener('wheel', function (e) {
            e.preventDefault();
            var rect = s.svg.getBoundingClientRect();
            var mx = e.clientX - rect.left;
            var my = e.clientY - rect.top;
            var delta = -e.deltaY * 0.0015;
            var newVs = Math.max(0.2, Math.min(4, s.vs * (1 + delta)));
            var ratio = newVs / s.vs;
            s.vx = mx - (mx - s.vx) * ratio;
            s.vy = my - (my - s.vy) * ratio;
            s.vs = newVs;
            applyGraphTransform();
        }, { passive: false });
        s.nodeEls.forEach(function (g) {
            g.addEventListener('click', function (e) {
                e.stopPropagation();
                selectGraphNode(g.getAttribute('data-id'));
            });
        });
        s.canvas.addEventListener('click', function (e) {
            if (e.target.closest && e.target.closest('.gnode')) return;
            if (s.selectedId) clearGraphSelection();
        });
        var gs = document.getElementById('graph-search');
        if (gs) gs.addEventListener('input', function () {
            var q = (gs.value || '').trim().toLowerCase();
            s.nodeEls.forEach(function (g) {
                g.classList.toggle('match', !!q && (g.getAttribute('data-name') || '').indexOf(q) !== -1);
            });
        });
    }

    function selectGraphNode(id) {
        if (!GRAPH_STATE) return;
        var s = GRAPH_STATE;
        s.selectedId = id;
        var neighbors = {}; neighbors[id] = 1;
        var incident = [];
        s.edgeEls.forEach(function (e) {
            var src = e.getAttribute('data-source'), tgt = e.getAttribute('data-target');
            if (src === id || tgt === id) { incident.push(e); neighbors[src] = 1; neighbors[tgt] = 1; }
        });
        s.nodeEls.forEach(function (g) {
            var gid = g.getAttribute('data-id');
            g.classList.toggle('selected', gid === id);
            g.classList.toggle('highlight', gid !== id && !!neighbors[gid]);
            g.classList.toggle('dim', !neighbors[gid]);
        });
        s.edgeEls.forEach(function (e) {
            var hi = incident.indexOf(e) !== -1;
            e.classList.toggle('highlight', hi);
            e.classList.toggle('dim', !hi);
        });
        renderGraphSelectedInfo(id, incident);
    }
    function clearGraphSelection() {
        if (!GRAPH_STATE) return;
        GRAPH_STATE.selectedId = null;
        GRAPH_STATE.nodeEls.forEach(function (g) { g.classList.remove('selected', 'highlight', 'dim'); });
        GRAPH_STATE.edgeEls.forEach(function (e) { e.classList.remove('highlight', 'dim'); });
        var box = document.getElementById('graph-selected-info');
        if (box) box.innerHTML = '<p class="panel-empty">Click a node to inspect.</p>';
    }
    function renderGraphSelectedInfo(id, incident) {
        var box = document.getElementById('graph-selected-info');
        if (!box || !window.__LINKAGE__) return;
        var nd = window.__LINKAGE__.nodes[id];
        if (!nd) { box.innerHTML = '<p class="panel-empty">Unknown node.</p>'; return; }
        var out = 0, inc = 0;
        for (var i = 0; i < incident.length; i++) {
            if (incident[i].getAttribute('data-source') === id) out++; else inc++;
        }
        var m = ltMeta(nd.type);
        box.innerHTML =
            '<div class="gsi-name">' + m.emoji + ' ' + escapeHtml(nd.name) + '</div>' +
            '<div class="gsi-kind">' + escapeHtml(m.label) + '</div>' +
            '<div class="gsi-id">' + escapeHtml(id) + '</div>' +
            '<div class="gsi-deg"><span style="color:#16a34a">↗ out ' + out + '</span> · <span style="color:#2563eb">↙ in ' + inc + '</span></div>' +
            '<a class="gsi-link" href="#' + escapeHtml(nd.cardId) + '">Open in Assets view →</a>';
    }
    function focusGraphNode(id) {
        if (!GRAPH_RENDERED) ensureGraphRendered();
        setTimeout(function () {
            if (!GRAPH_STATE) return;
            var s = GRAPH_STATE;
            var g = s.nodeIndex[id];
            if (!g) return;
            var tr = g.getAttribute('transform') || '';
            var m = tr.match(/translate\\(([-0-9.]+),([-0-9.]+)\\)/);
            if (!m) return;
            var rect = s.svg.getBoundingClientRect();
            var vb = s.svg.viewBox.baseVal;
            var px = parseFloat(m[1]) * (rect.width / vb.width);
            var py = parseFloat(m[2]) * (rect.height / vb.height);
            s.vs = 2;
            s.vx = rect.width / 2 - px * s.vs;
            s.vy = rect.height / 2 - py * s.vs;
            applyGraphTransform();
            selectGraphNode(id);
        }, 50);
    }

    // --- Copy button --------------------------------------------------------

    function makeCopyBtn(getText, title) {
        var btn = el('button', {
            class: 'copy-btn', type: 'button', title: title || 'Copy',
            'aria-label': title || 'Copy'
        }, ['⧉']);
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var t = typeof getText === 'function' ? getText() : getText;
            if (!t) return;
            var done = function () {
                btn.classList.add('copied');
                btn.textContent = '✓';
                setTimeout(function () {
                    btn.classList.remove('copied');
                    btn.textContent = '⧉';
                }, 900);
            };
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(t).then(done, function () {
                        fallbackCopy(t); done();
                    });
                } else { fallbackCopy(t); done(); }
            } catch (_) { fallbackCopy(t); done(); }
        });
        return btn;
    }

    function fallbackCopy(t) {
        try {
            var ta = document.createElement('textarea');
            ta.value = t;
            ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        } catch (_) {}
    }

    function attachCopyButtons(root) {
        // IDs in card heads
        var ids = root.querySelectorAll('.card-id');
        for (var i = 0; i < ids.length; i++) (function (node) {
            if (node.querySelector('.copy-btn')) return;
            node.appendChild(makeCopyBtn(function () { return node.firstChild && node.firstChild.nodeValue || node.textContent; }, 'Copy ID'));
        })(ids[i]);
        // Link Key <code> fields (anything that looks like a merge tag)
        var codes = root.querySelectorAll('.field .value code');
        for (var j = 0; j < codes.length; j++) (function (node) {
            var txt = node.textContent || '';
            if (!/^\\{\\{.+\\}\\}$/.test(txt.trim())) return;
            if (node.nextSibling && node.nextSibling.classList && node.nextSibling.classList.contains('copy-btn')) return;
            var btn = makeCopyBtn(txt.trim(), 'Copy merge tag');
            node.parentNode.insertBefore(btn, node.nextSibling);
        })(codes[j]);
    }

    // --- Search (enhanced) --------------------------------------------------

    function runSearch(q) {
        var root = document.getElementById('pane-assets');
        var cards = root.querySelectorAll('.card');
        var shown = 0;
        q = q.trim().toLowerCase();
        for (var i = 0; i < cards.length; i++) {
            var haystack = cards[i].getAttribute('data-search') || '';
            var hit = !q || haystack.indexOf(q) !== -1;
            cards[i].classList.toggle('hidden', !hit);
            if (hit) shown++;
        }
        // Open sections when searching so matches are visible
        if (q) {
            var openables = root.querySelectorAll('details.section, details.folder-group');
            for (var s = 0; s < openables.length; s++) openables[s].open = true;
        }
        // Hide whole sections that have zero matching cards
        var sections = root.querySelectorAll('details.section');
        for (var sx = 0; sx < sections.length; sx++) {
            var visibleCards = sections[sx].querySelectorAll('.card:not(.hidden)').length;
            sections[sx].style.display = (q && visibleCards === 0) ? 'none' : '';
        }
        var total = cards.length;
        var matchEl = document.getElementById('matchCount');
        if (matchEl) {
            matchEl.innerHTML = q
                ? '<b>' + shown + '</b> of <b>' + total + '</b> assets match'
                : '<b>' + total + '</b> total assets';
        }
        var noRes = document.getElementById('noResults');
        if (noRes) noRes.classList.toggle('show', !!q && shown === 0);
    }

    // --- Tabs ---------------------------------------------------------------

    function setView(view) {
        var buttons = document.querySelectorAll('.view-toggle button');
        for (var i = 0; i < buttons.length; i++) {
            var isActive = buttons[i].getAttribute('data-view') === view;
            buttons[i].classList.toggle('active', isActive);
            buttons[i].setAttribute('aria-selected', isActive ? 'true' : 'false');
        }
        document.getElementById('pane-overview').classList.toggle('active', view === 'overview');
        var gpane = document.getElementById('pane-graph');
        if (gpane) gpane.classList.toggle('active', view === 'graph');
        document.getElementById('pane-assets').classList.toggle('active', view === 'assets');
        // Lazy-init the graph on first visit (layout is expensive)
        if (view === 'graph' && typeof ensureGraphRendered === 'function') {
            ensureGraphRendered();
        }
        // Scroll to top on switch
        if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0);
    }

    function init() {
        var mount = document.getElementById('main');
        var toc = document.getElementById('nav');

        // Determine render order: known keys first, then any extras
        var seen = {};
        var renderKeys = [];
        for (var i = 0; i < TYPE_ORDER.length; i++) {
            var k = TYPE_ORDER[i];
            if (DATA.hasOwnProperty(k)) { renderKeys.push(k); seen[k] = true; }
        }
        for (var k3 in DATA) {
            if (k3.charAt(0) === '_') continue;
            if (seen[k3]) continue;
            renderKeys.push(k3);
        }

        // Pre-pass: build name -> cardId index so ref chips can resolve
        // to deep-links before any card renders.
        buildNameIndex(renderKeys);

        // Asset sections: expand the top N so something is visible without clicks.
        // With lots of asset types, expanding everything makes the first paint huge.
        var rendered = 0;
        for (var j = 0; j < renderKeys.length; j++) {
            var rk = renderKeys[j];
            var section = renderSection(rk, DATA[rk], rendered < 2);
            if (!section) continue;
            mount.appendChild(section);
            rendered++;
            section.id = 'section-' + rk;

            // TOC entry
            var cfg = TYPE_CONFIG[rk] || { label: rk };
            var cnt = getList(DATA[rk]).length;
            var a = el('a', { href: '#section-' + rk, 'data-section': rk }, [
                el('span', null, [cfg.label || rk]),
                el('span', { class: 'count' }, [String(cnt)])
            ]);
            toc.appendChild(a);
        }

        // Stats + counts in header
        var summary = computeSummary(renderKeys);
        document.getElementById('stats').textContent =
            formatNum(summary.totalAssets) + ' total assets across ' + rendered + ' types';
        var assetsTabCount = document.getElementById('assetsTabCount');
        if (assetsTabCount) assetsTabCount.textContent = formatNum(summary.totalAssets);

        // Render the Overview pane
        var overviewPane = document.getElementById('pane-overview');
        renderOverview(overviewPane, summary);

        // --- Linkage: extract cross-asset edges once, then decorate UI --------
        var linkage = null;
        try {
            linkage = computeLinkage(DATA);
            window.__LINKAGE__ = linkage;
            var gCount = document.getElementById('graphTabCount');
            if (gCount) gCount.textContent = formatNum(linkage.stats.totalNodes);
            renderLinkageOverview(overviewPane, linkage);
            enrichCardsWithEdges(linkage);
        } catch (err) {
            if (typeof console !== 'undefined' && console.warn) console.warn('Linkage extraction failed:', err);
        }

        // Copy buttons on IDs + Link Keys
        attachCopyButtons(document.getElementById('pane-assets'));

        // Open enclosing <details> ancestors before scrolling into any in-page anchor.
        function revealTarget(hash) {
            if (!hash || hash.charAt(0) !== '#') return;
            var node = document.getElementById(hash.slice(1));
            if (!node) return;
            // If the target is inside the Assets pane, switch there first.
            if (node.closest && node.closest('#pane-assets')) setView('assets');
            else if (node.id && node.id.indexOf('section-') === 0) setView('assets');
            var p = node.parentNode;
            while (p && p.nodeType === 1) {
                if (p.tagName === 'DETAILS' && !p.open) p.open = true;
                p = p.parentNode;
            }
            // After switching views, scroll the node into view explicitly.
            setTimeout(function () {
                if (node.scrollIntoView) node.scrollIntoView({ block: 'start', behavior: 'smooth' });
            }, 0);
        }

        // Intercept in-page anchor clicks (ref chips, TOC, overview charts).
        document.addEventListener('click', function (e) {
            var a = e.target;
            while (a && a.tagName !== 'A') a = a.parentNode;
            if (!a || !a.getAttribute) return;
            var href = a.getAttribute('href');
            if (href && href.charAt(0) === '#' && href.length > 1) revealTarget(href);
        });
        if (location.hash) setTimeout(function () { revealTarget(location.hash); }, 0);

        // Tabs
        var toggleBtns = document.querySelectorAll('.view-toggle button');
        for (var tb = 0; tb < toggleBtns.length; tb++) {
            toggleBtns[tb].addEventListener('click', function (e) {
                setView(e.currentTarget.getAttribute('data-view'));
            });
        }

        // Search (enhanced)
        var searchInput = document.getElementById('search');
        var searchWrap = searchInput.parentElement;
        var searchClear = document.getElementById('searchClear');
        function onSearchChange() {
            var q = searchInput.value;
            searchWrap.classList.toggle('has-value', q.length > 0);
            if (q.length > 0) setView('assets');
            runSearch(q);
        }
        searchInput.addEventListener('input', onSearchChange);
        searchClear.addEventListener('click', function () {
            searchInput.value = '';
            onSearchChange();
            searchInput.focus();
        });
        document.addEventListener('keydown', function (e) {
            // "/" focuses search (unless user is typing in a field)
            if (e.key === '/' && document.activeElement !== searchInput) {
                var tag = (document.activeElement && document.activeElement.tagName) || '';
                if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
                    e.preventDefault(); searchInput.focus(); searchInput.select();
                }
            } else if (e.key === 'Escape' && document.activeElement === searchInput) {
                searchInput.value = ''; onSearchChange(); searchInput.blur();
            }
        });
        // Initial match count
        runSearch('');

        // Toolbar buttons
        var expandBtn = document.getElementById('expandAllBtn');
        var collapseBtn = document.getElementById('collapseAllBtn');
        var topBtn = document.getElementById('backToTopBtn');
        expandBtn && expandBtn.addEventListener('click', function () {
            var opens = document.querySelectorAll('#pane-assets details.section, #pane-assets details.folder-group');
            for (var i = 0; i < opens.length; i++) opens[i].open = true;
        });
        collapseBtn && collapseBtn.addEventListener('click', function () {
            var opens = document.querySelectorAll('#pane-assets details.section, #pane-assets details.folder-group');
            for (var i = 0; i < opens.length; i++) opens[i].open = false;
        });
        topBtn && topBtn.addEventListener('click', function () {
            if (window.scrollTo) window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // Active TOC highlight via IntersectionObserver
        if ('IntersectionObserver' in window) {
            var navLinks = {};
            var tocLinks = toc.querySelectorAll('a[data-section]');
            for (var nl = 0; nl < tocLinks.length; nl++) {
                navLinks[tocLinks[nl].getAttribute('data-section')] = tocLinks[nl];
            }
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    var key = entry.target.id.replace(/^section-/, '');
                    for (var k in navLinks) navLinks[k].classList.remove('active');
                    if (navLinks[key]) navLinks[key].classList.add('active');
                });
            }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });
            var sections = document.querySelectorAll('#pane-assets details.section');
            for (var ss = 0; ss < sections.length; ss++) io.observe(sections[ss]);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
`;

    const safeLocId = (locationId || 'unknown').replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });

    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n'
        + '<meta charset="utf-8">\n'
        + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        + '<title>Super Snapshot AI — Location ' + safeLocId + '</title>\n'
        + '<style>' + css + '</style>\n'
        + '</head>\n<body>\n'
        + '<div class="layout">\n'
        + '  <aside>\n'
        + '    <div class="brand">\n'
        + '      <div class="brand-title"><span class="brand-logo">⚡</span>Super Snapshot AI <span class="brand-badge">v1</span></div>\n'
        + '      <p class="brand-tagline">AI-powered GHL documentation &amp; export</p>\n'
        + '    </div>\n'
        + '    <div class="location-box">\n'
        + '      <div class="label">Location ID</div>\n'
        + '      <code>' + safeLocId + '</code>\n'
        + '    </div>\n'
        + '    <div class="nav-wrap">\n'
        + '      <h3 class="nav-title">Jump to</h3>\n'
        + '      <nav class="nav" id="nav"></nav>\n'
        + '    </div>\n'
        + '  </aside>\n'
        + '  <main>\n'
        + '    <header class="pageheader">\n'
        + '      <h1>Location Snapshot</h1>\n'
        + '      <div class="meta"><span id="stats">…</span><span class="divider">·</span>Exported <code>' + exportedAt + '</code></div>\n'
        + '      <div class="search-wrap">\n'
        + '        <input id="search" type="search" placeholder="Search assets by name, id, or content…" autocomplete="off">\n'
        + '        <kbd>/</kbd>\n'
        + '        <button id="searchClear" type="button" title="Clear search" aria-label="Clear search">×</button>\n'
        + '      </div>\n'
        + '    </header>\n'
        + '    <div class="view-toggle" role="tablist">\n'
        + '      <button type="button" class="active" data-view="overview" role="tab" aria-selected="true">📊 Overview</button>\n'
        + '      <button type="button" data-view="graph" role="tab" aria-selected="false">🌐 Graph <span class="tab-count" id="graphTabCount">0</span></button>\n'
        + '      <button type="button" data-view="assets" role="tab" aria-selected="false">📂 Assets <span class="tab-count" id="assetsTabCount">0</span></button>\n'
        + '    </div>\n'
        + '    <div class="tab-pane active" id="pane-overview" role="tabpanel"></div>\n'
        + '    <div class="tab-pane" id="pane-graph" role="tabpanel"></div>\n'
        + '    <div class="tab-pane" id="pane-assets" role="tabpanel">\n'
        + '      <div class="assets-toolbar">\n'
        + '        <div class="assets-toolbar-inner">\n'
        + '          <button type="button" class="tool-btn" id="expandAllBtn" title="Expand all sections">▾ Expand all</button>\n'
        + '          <button type="button" class="tool-btn" id="collapseAllBtn" title="Collapse all sections">▴ Collapse all</button>\n'
        + '          <button type="button" class="tool-btn" id="backToTopBtn" title="Back to top">↑ Top</button>\n'
        + '          <span class="match-count" id="matchCount"></span>\n'
        + '        </div>\n'
        + '      </div>\n'
        + '      <div id="main"></div>\n'
        + '      <div class="no-results" id="noResults"><div class="icon">🔍</div>No assets match your search.</div>\n'
        + '    </div>\n'
        + '  </main>\n'
        + '</div>\n'
        + '<script>window.SNAPSHOT_DATA = ' + safeJson + '; window.LOCATION_ID = ' + safeLocationId + ';</script>\n'
        + '<script>' + js + '</script>\n'
        + '</body>\n</html>\n';
}

/**
 * Convert snapshot data to multiple CSV files (one per asset type)
 */
async function convertSnapshotToCSVs(snapshotData, snapshotId, selectedAssets = null) {
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
        { key: 'media', name: 'Media' },
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
        { key: 'sectionTemplates', name: 'Section_Templates' },
        { key: 'voice_ai_agents', name: 'Voice_AI_Agents' },
        { key: 'ai_employees', name: 'AI_Employees' },
        { key: 'documents', name: 'Documents' },
        { key: 'snippets', name: 'Snippets' },
        { key: 'objects', name: 'Objects' }
    ];

    // Filter asset types based on user selection
    const assetsToExport = selectedAssets
        ? assetTypes.filter(type => selectedAssets.includes(type.key))
        : assetTypes;

    // Process each asset type
    for (const assetType of assetsToExport) {
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
async function convertSnapshotToExcel(snapshotData, snapshotId, companyId, selectedAssets = null) {
    // First, fetch snapshot metadata to get locationId and additional details
    let locationId = null;
    let snapshotMetadata = {};

    try {
        const snapshotDetailsEndpoint = `/snapshots/snapshotDetails/${snapshotId}?companyId=${companyId}`;
        await window.ghlUtilsRevex.waitForReady();
        const snapshotDetailsResponse = await window.ghlUtilsRevex.get(snapshotDetailsEndpoint);

        if (snapshotDetailsResponse && snapshotDetailsResponse.data) {
            snapshotMetadata = snapshotDetailsResponse.data;
            locationId = snapshotMetadata.locationId;
        }
    } catch (error) {
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
        { key: 'links', name: 'Trigger Links' },
        { key: 'folders', name: 'Folders' },
        { key: 'media', name: 'Media' },
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
        { key: 'sectionTemplates', name: 'Section Templates' },
        { key: 'voice_ai_agents', name: 'Voice AI Agents' },
        { key: 'ai_employees', name: 'AI Employees' },
        { key: 'documents', name: 'Documents' },
        { key: 'snippets', name: 'Snippets' },
        { key: 'objects', name: 'Objects' }
    ];

    // Filter asset types based on user selection
    const assetsToExport = selectedAssets
        ? assetTypes.filter(type => selectedAssets.includes(type.key))
        : assetTypes;

    // Capture export date for use in sheet headers
    const exportDate = new Date().toISOString();

    // Create summary data for summary sheet
    const summaryData = [];
    summaryData.push(['GHL Snapshot Export Summary']);
    summaryData.push(['Snapshot ID', snapshotId]);
    summaryData.push(['Snapshot Name', snapshotMetadata.name || 'N/A']);
    summaryData.push(['Location ID', locationId || 'N/A']);
    summaryData.push(['Snapshot Type', snapshotMetadata.type || 'N/A']);
    summaryData.push(['Date Created', snapshotMetadata.dateAdded || 'N/A']);
    summaryData.push(['Date Updated', snapshotMetadata.dateUpdated || 'N/A']);
    summaryData.push(['Export Date', exportDate]);
    summaryData.push(['Export Format', 'Excel Workbook (.xlsx)']);
    summaryData.push([]);
    summaryData.push(['Asset Type', 'Count', 'Sheet Name']);

    // Create master list data (all assets combined)
    const masterListData = [];
    masterListData.push(['ID', 'Name', 'Type of Asset']);

    let totalAssets = 0;
    let sheetsCreated = 0;

    // Defer trigger links so we can populate reverse-lookup columns from
    // every other enriched asset. Processed after the main loop.
    let deferredSnapshotLinkAssets = null;

    // Pre-enrich workflows to build tag → workflow reverse map before processing tags
    const tagToWorkflowMap = new Map();
    let cachedSnapshotEnrichedWorkflows = null;
    const snapshotWorkflowAssets = snapshotData['workflow'];
    if (snapshotWorkflowAssets && snapshotWorkflowAssets.length > 0 && locationId) {
        const aiSettings = await chrome.storage.local.get(['aiAnalysisEnabled', 'openaiApiKey']);
        const aiEnabled = aiSettings.aiAnalysisEnabled === true && aiSettings.openaiApiKey;
        const progressMsg = aiEnabled
            ? `Analyzing ${snapshotWorkflowAssets.length} workflows with AI...`
            : `Enriching ${snapshotWorkflowAssets.length} workflows...`;
        sendProgressUpdate(35, progressMsg);

        cachedSnapshotEnrichedWorkflows = await enrichWorkflowsWithAI(snapshotWorkflowAssets, companyId, snapshotId);

        // Build tag → workflow name reverse map
        cachedSnapshotEnrichedWorkflows.forEach(wf => {
            const wfName = wf.name || 'Unnamed Workflow';
            const tagsUsed = wf.tagsUsed || '';
            if (tagsUsed) {
                tagsUsed.split('; ').forEach(tagName => {
                    if (!tagToWorkflowMap.has(tagName)) {
                        tagToWorkflowMap.set(tagName, []);
                    }
                    tagToWorkflowMap.get(tagName).push(wfName);
                });
            }
        });
    }

    // Count tag usage across contacts (drives tags.contactCount) using the
    // per-tag /contacts/search/2 filter — exact `total` per call, no cursor
    // pagination.
    let snapshotTagContactCountMap = new Map();
    const willExportSnapshotTags = locationId
        && assetsToExport.some(t => t.key === 'tags')
        && (snapshotData['tags'] || []).length > 0;
    if (willExportSnapshotTags) {
        const tagNames = (snapshotData['tags'] || []).map(t => t && t.name).filter(Boolean);
        sendProgressUpdate(38, `Counting contacts for ${tagNames.length} tags...`);
        snapshotTagContactCountMap = await fetchContactsAndCountTags(locationId, tagNames, (done, total) => {
            sendProgressUpdate(38, `Counting contacts per tag (${done}/${total})...`);
        });
    }

    // Process each asset type
    for (const assetType of assetsToExport) {
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

            // Special handling for workflows - use pre-enriched data from above
            if (assetType.key === 'workflow' && locationId) {
                const enrichedWorkflows = cachedSnapshotEnrichedWorkflows || assets;

                // Filter to only include workflows that exist in the original snapshot
                const filteredWorkflows = filterBySnapshotIds(enrichedWorkflows, assets);
                const sheetData = convertWorkflowsToArray(filteredWorkflows);
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
                // Fetch and create Workflow Triggers sheet
                sendProgressUpdate(40, `Fetching triggers for ${assets.length} workflows...`);
                const workflowTriggers = await fetchWorkflowTriggers(assets, locationId);

                if (workflowTriggers.length > 0) {
                    // Filter triggers to only include those for workflows in the snapshot
                    const snapshotWorkflowIds = new Set(assets.map(w => w.id || w._id));
                    const filteredTriggers = workflowTriggers.filter(t => snapshotWorkflowIds.has(t.workflowId));

                    const triggerSheetData = convertAssetTypeToArray(filteredTriggers);
                    const triggerWorksheet = XLSX.utils.aoa_to_sheet(triggerSheetData);
                    triggerWorksheet['!cols'] = triggerSheetData[0].map(() => ({ wch: 20 }));
                    XLSX.utils.book_append_sheet(workbook, triggerWorksheet, 'Workflow_Triggers');
                    sheetsCreated++;
                }

                // Email Actions: pull every send_email step from the snapshot's
                // workflows, resolve any snippet references, and enrich each
                // step with its trigger config (open/click/etc.). Mutates the
                // workflow templates in place so the workflow rows also carry
                // `_snippetContent` / `_triggers` per email step.
                sendProgressUpdate(41, `Fetching email snippets...`);
                const snippetMap = await fetchEmailSnippets(locationId);
                sendProgressUpdate(42, `Collating email actions across ${filteredWorkflows.length} workflows...`);
                const emailActions = await collectEmailActionsFromWorkflows(
                    filteredWorkflows,
                    locationId,
                    snippetMap,
                    (done, total) => {
                        const label = total
                            ? `Fetching email triggers (${done}/${total})...`
                            : `Fetching email triggers (${done})...`;
                        sendProgressUpdate(42, label);
                    }
                );

                if (emailActions.length > 0) {
                    const emailActionsSheetData = convertAssetTypeToArray(emailActions);
                    const emailActionsWorksheet = XLSX.utils.aoa_to_sheet(emailActionsSheetData);
                    emailActionsWorksheet['!cols'] = emailActionsSheetData[0].map(() => ({ wch: 25 }));
                    XLSX.utils.book_append_sheet(workbook, emailActionsWorksheet, 'Email Actions');
                    sheetsCreated++;
                }
            }
            // Special handling for Forms - enrich with full data
            else if (assetType.key === 'forms' && locationId) {
                sendProgressUpdate(40, `Enriching ${assets.length} forms...`);

                const enrichedForms = await enrichForms(assets, locationId);
                // Filter to only include forms that exist in the original snapshot
                const filteredForms = filterBySnapshotIds(enrichedForms, assets);
                const sheetData = convertAssetTypeToArray(filteredForms);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Forms');
                sheetsCreated++;
            }
            // Special handling for Funnels - enrich with full data
            else if (assetType.key === 'funnels' && locationId) {
                sendProgressUpdate(45, `Starting funnel enrichment for ${assets.length} funnel${assets.length > 1 ? 's' : ''}... This may take a while.`);

                const { enrichedFunnels, allPages, allSteps, allElementCounts } = await enrichFunnels(assets, locationId);
                // Filter to only include funnels that exist in the original snapshot
                const filteredFunnels = filterBySnapshotIds(enrichedFunnels, assets);

                // Create main Funnels sheet
                const sheetData = convertAssetTypeToArray(filteredFunnels);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Funnels');
                sheetsCreated++;
                // Create Funnel Pages sheet
                if (allPages.length > 0) {
                    sendProgressUpdate(46, `Creating Funnel Pages sheet with ${allPages.length} pages...`);
                    const pagesSheetData = convertAssetTypeToArray(allPages);
                    const pagesWorksheet = XLSX.utils.aoa_to_sheet(pagesSheetData);
                    const pagesColWidths = pagesSheetData[0].map(() => ({ wch: 20 }));
                    pagesWorksheet['!cols'] = pagesColWidths;
                    XLSX.utils.book_append_sheet(workbook, pagesWorksheet, 'Funnel Pages');
                    sheetsCreated++;
                }

                // Create Funnel Steps sheet
                if (allSteps.length > 0) {
                    sendProgressUpdate(47, `Creating Funnel Steps sheet with ${allSteps.length} steps...`);
                    const stepsSheetData = convertAssetTypeToArray(allSteps);
                    const stepsWorksheet = XLSX.utils.aoa_to_sheet(stepsSheetData);
                    const stepsColWidths = stepsSheetData[0].map(() => ({ wch: 20 }));
                    stepsWorksheet['!cols'] = stepsColWidths;
                    XLSX.utils.book_append_sheet(workbook, stepsWorksheet, 'Funnel Steps');
                    sheetsCreated++;
                }

                // Create Funnel Page Elements sheet
                if (allElementCounts.length > 0) {
                    sendProgressUpdate(48, `Creating Funnel Page Elements sheet...`);
                    const elementsSheetData = convertAssetTypeToArray(allElementCounts);
                    const elementsWorksheet = XLSX.utils.aoa_to_sheet(elementsSheetData);
                    const elementsColWidths = elementsSheetData[0].map(() => ({ wch: 15 }));
                    elementsWorksheet['!cols'] = elementsColWidths;
                    XLSX.utils.book_append_sheet(workbook, elementsWorksheet, 'Funnel Page Elements');
                    sheetsCreated++;
                }
            }
            // Special handling for Calendars - enrich with full data
            else if (assetType.key === 'calendars' && locationId) {
                sendProgressUpdate(50, `Enriching ${assets.length} calendars...`);

                const enrichedCalendars = await enrichCalendars(assets, locationId);
                // Filter to only include calendars that exist in the original snapshot
                const filteredCalendars = filterBySnapshotIds(enrichedCalendars, assets);
                const sheetData = convertAssetTypeToArray(filteredCalendars);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Calendars');
                sheetsCreated++;
                // Also create a Calendar Configuration sheet
                sendProgressUpdate(52, `Extracting calendar configuration...`);
                const calendarConfig = await extractCalendarConfiguration(locationId);
                if (calendarConfig) {
                    const configSheetData = convertAssetTypeToArray([calendarConfig]);
                    const configWorksheet = XLSX.utils.aoa_to_sheet(configSheetData);
                    const configColWidths = configSheetData[0].map(() => ({ wch: 20 }));
                    configWorksheet['!cols'] = configColWidths;
                    XLSX.utils.book_append_sheet(workbook, configWorksheet, 'Calendar Configuration');
                    sheetsCreated++;
                }

                // Also create a Calendar Groups sheet
                sendProgressUpdate(53, `Extracting calendar groups...`);
                const calendarGroups = await enrichCalendarGroups(locationId);
                if (calendarGroups && calendarGroups.length > 0) {
                    const groupsSheetData = convertAssetTypeToArray(calendarGroups);
                    const groupsWorksheet = XLSX.utils.aoa_to_sheet(groupsSheetData);
                    const groupsColWidths = groupsSheetData[0].map(() => ({ wch: 20 }));
                    groupsWorksheet['!cols'] = groupsColWidths;
                    XLSX.utils.book_append_sheet(workbook, groupsWorksheet, 'Calendar Groups');
                    sheetsCreated++;
                }
            }
            // Special handling for Pipelines - enrich with full data
            else if (assetType.key === 'pipelines' && locationId) {
                sendProgressUpdate(55, `Enriching ${assets.length} pipelines...`);

                const enrichedPipelines = await enrichPipelines(assets, locationId);
                // Filter to only include pipelines that exist in the original snapshot
                const filteredPipelines = filterBySnapshotIds(enrichedPipelines, assets);
                const sheetData = convertAssetTypeToArray(filteredPipelines);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Pipelines');
                sheetsCreated++;
                // Also create a detailed Pipeline Stages sheet
                sendProgressUpdate(57, `Extracting pipeline stages...`);
                const pipelineStages = extractPipelineStages(filteredPipelines);
                if (pipelineStages && pipelineStages.length > 0) {
                    const stagesSheetData = convertAssetTypeToArray(pipelineStages);
                    const stagesWorksheet = XLSX.utils.aoa_to_sheet(stagesSheetData);
                    const stagesColWidths = stagesSheetData[0].map(() => ({ wch: 20 }));
                    stagesWorksheet['!cols'] = stagesColWidths;
                    XLSX.utils.book_append_sheet(workbook, stagesWorksheet, 'Pipeline Stages');
                    sheetsCreated++;
                }
            }
            // Special handling for Email Templates - enrich with full data
            else if (assetType.key === 'email_templates' && locationId) {
                sendProgressUpdate(60, `Enriching ${assets.length} email templates...`);

                const enrichedTemplates = await enrichEmailTemplates(assets, locationId);
                // Filter to only include email templates that exist in the original snapshot
                const filteredTemplates = filterBySnapshotIds(enrichedTemplates, assets);
                const sheetData = convertAssetTypeToArray(filteredTemplates);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Email Templates');
                sheetsCreated++;
                // Also create an Email Builder sheet
                sendProgressUpdate(62, `Extracting email builder templates...`);
                const emailBuilderTemplates = await enrichEmailBuilderTemplates(locationId);
                if (emailBuilderTemplates && emailBuilderTemplates.length > 0) {
                    const builderSheetData = convertAssetTypeToArray(emailBuilderTemplates);
                    const builderWorksheet = XLSX.utils.aoa_to_sheet(builderSheetData);
                    const builderColWidths = builderSheetData[0].map(() => ({ wch: 20 }));
                    builderWorksheet['!cols'] = builderColWidths;
                    XLSX.utils.book_append_sheet(workbook, builderWorksheet, 'Email Builder');
                    sheetsCreated++;
                }
            }
            // Special handling for Surveys - enrich with full data
            else if (assetType.key === 'surveys' && locationId) {
                sendProgressUpdate(65, `Enriching ${assets.length} surveys...`);

                const enrichedSurveys = await enrichSurveys(assets);
                // Filter to only include surveys that exist in the original snapshot
                const filteredSurveys = filterBySnapshotIds(enrichedSurveys, assets);
                const sheetData = convertAssetTypeToArray(filteredSurveys);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Surveys');
                sheetsCreated++;
            }
            // Special handling for Campaigns - enrich with statistics
            else if (assetType.key === 'campaigns' && locationId) {
                sendProgressUpdate(68, `Enriching ${assets.length} campaigns...`);

                const enrichedCampaigns = await enrichCampaigns(assets, locationId);
                // Filter to only include campaigns that exist in the original snapshot
                const filteredCampaigns = filterBySnapshotIds(enrichedCampaigns, assets);
                const sheetData = convertAssetTypeToArray(filteredCampaigns);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Campaigns');
                sheetsCreated++;
            }
            // Special handling for Links - deferred to after the loop so we can
            // cross-reference every other enriched asset (forms, workflows, etc.)
            else if (assetType.key === 'links' && locationId) {
                deferredSnapshotLinkAssets = assets;
            }
            // Special handling for Text Templates - enrich with content details
            else if (assetType.key === 'text_templates' && locationId) {
                sendProgressUpdate(72, `Enriching ${assets.length} text templates...`);

                const enrichedTextTemplates = await enrichTextTemplates(assets, locationId);
                // Filter to only include text templates that exist in the original snapshot
                const filteredTextTemplates = filterBySnapshotIds(enrichedTextTemplates, assets);
                const sheetData = convertAssetTypeToArray(filteredTextTemplates);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Text_Templates');
                sheetsCreated++;
            }
            // Special handling for Membership Offers - enrich with pricing and products
            else if (assetType.key === 'membership_offers' && locationId) {
                sendProgressUpdate(75, `Enriching ${assets.length} membership offers...`);

                const enrichedOffers = await enrichMembershipOffers(assets, locationId);
                // Filter to only include membership offers that exist in the original snapshot
                const filteredOffers = filterBySnapshotIds(enrichedOffers, assets);
                const sheetData = convertAssetTypeToArray(filteredOffers);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Membership_Offers');
                sheetsCreated++;
            }
            // Special handling for Custom Fields - enrich with folder and model data
            else if (assetType.key === 'custom_fields' && locationId) {
                sendProgressUpdate(77, `Enriching ${assets.length} custom fields...`);

                const enrichedFields = await enrichCustomFields(assets, locationId);
                // Filter to only include custom fields that exist in the original snapshot
                const filteredFields = filterBySnapshotIds(enrichedFields, assets);
                const sheetData = convertAssetTypeToArray(filteredFields);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Custom_Fields');
                sheetsCreated++;
            }
            // Special handling for Custom Values - enrich with organization details
            else if (assetType.key === 'custom_values' && locationId) {
                sendProgressUpdate(78, `Enriching ${assets.length} custom values...`);

                const enrichedValues = await enrichCustomValues(assets, locationId);
                // Filter to only include custom values that exist in the original snapshot
                const filteredValues = filterBySnapshotIds(enrichedValues, assets);
                const sheetData = convertAssetTypeToArray(filteredValues);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Custom_Values');
                sheetsCreated++;
            }
            // Special handling for Tags - enrich with usage statistics
            else if (assetType.key === 'tags' && locationId) {
                sendProgressUpdate(79, `Enriching ${assets.length} tags...`);

                const enrichedTags = await enrichTags(assets, locationId, tagToWorkflowMap, snapshotTagContactCountMap);
                // Filter to only include tags that exist in the original snapshot
                const filteredTags = filterBySnapshotIds(enrichedTags, assets);
                const sheetData = convertAssetTypeToArray(filteredTags);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Tags');
                sheetsCreated++;
            }
            // Special handling for Knowledge Bases - enrich with files and content
            else if (assetType.key === 'knowledge_bases' && locationId) {
                sendProgressUpdate(80, `Enriching ${assets.length} knowledge bases...`);

                const enrichedKBs = await enrichKnowledgeBases(assets, locationId);
                // Filter to only include knowledge bases that exist in the original snapshot
                const filteredKBs = filterBySnapshotIds(enrichedKBs, assets);
                const sheetData = convertAssetTypeToArray(filteredKBs);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Knowledge_Bases');
                sheetsCreated++;
            }
            // Special handling for Conversation AI - enrich with configuration and metrics
            else if (assetType.key === 'conversation_ai' && locationId) {
                sendProgressUpdate(81, `Enriching ${assets.length} AI employees...`);

                const enrichedEmployees = await enrichConversationAI(assets, locationId);
                // Filter to only include AI employees that exist in the original snapshot
                const filteredEmployees = filterBySnapshotIds(enrichedEmployees, assets);
                const sheetData = convertAssetTypeToArray(filteredEmployees);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Conversation_AI');
                sheetsCreated++;
            }
            // Special handling for Voice AI Agents - enrich with full configuration
            else if (assetType.key === 'voice_ai_agents' && locationId) {
                sendProgressUpdate(81, `Enriching ${assets.length} Voice AI agents...`);

                const enrichedAgents = await enrichVoiceAIAgents(assets, locationId);
                // Filter to only include agents that exist in the original snapshot
                const filteredAgents = filterBySnapshotIds(enrichedAgents, assets);
                const sheetData = convertAssetTypeToArray(filteredAgents);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Voice_AI_Agents');
                sheetsCreated++;
            }
            // Special handling for AI Employees - enrich with full configuration
            else if (assetType.key === 'ai_employees' && locationId) {
                sendProgressUpdate(81, `Enriching ${assets.length} AI employees...`);

                const enrichedEmployees = await enrichAIEmployees(assets, locationId);
                // Filter to only include employees that exist in the original snapshot
                const filteredEmployees = filterBySnapshotIds(enrichedEmployees, assets);
                const sheetData = convertAssetTypeToArray(filteredEmployees);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'AI_Employees');
                sheetsCreated++;
            }
            // Special handling for Documents - enrich with template details
            else if (assetType.key === 'documents' && locationId) {
                sendProgressUpdate(81, `Enriching ${assets.length} documents...`);

                const enrichedDocs = await enrichDocuments(assets, locationId);
                // Filter to only include documents that exist in the original snapshot
                const filteredDocs = filterBySnapshotIds(enrichedDocs, assets);
                const sheetData = convertAssetTypeToArray(filteredDocs);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Documents');
                sheetsCreated++;
            }
            // Special handling for Snippets - enrich with template details
            else if (assetType.key === 'snippets' && locationId) {
                sendProgressUpdate(82, `Enriching ${assets.length} snippets...`);

                const enrichedSnippets = await enrichSnippets(assets, locationId);
                // Filter to only include snippets that exist in the original snapshot
                const filteredSnippets = filterBySnapshotIds(enrichedSnippets, assets);
                const sheetData = convertAssetTypeToArray(filteredSnippets);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Snippets');
                sheetsCreated++;
            }
            // Special handling for Custom Objects - enrich with schema details
            else if (assetType.key === 'custom_objects' && locationId) {
                sendProgressUpdate(82, `Enriching ${assets.length} custom objects...`);

                const enrichedObjects = await enrichCustomObjects(assets, locationId);
                // Filter to only include custom objects that exist in the original snapshot
                const filteredObjects = filterBySnapshotIds(enrichedObjects, assets);
                const sheetData = convertAssetTypeToArray(filteredObjects);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Custom_Objects');
                sheetsCreated++;
            }
            // Special handling for Dashboards - enrich with widgets and permissions
            else if (assetType.key === 'dashboards' && locationId) {
                sendProgressUpdate(83, `Enriching ${assets.length} dashboards...`);

                const enrichedDashboards = await enrichDashboards(assets, locationId);
                // Filter to only include dashboards that exist in the original snapshot
                const filteredDashboards = filterBySnapshotIds(enrichedDashboards, assets);
                const sheetData = convertAssetTypeToArray(filteredDashboards);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Dashboards');
                sheetsCreated++;
            }
            // Special handling for Quizzes - enrich using forms API (quizzes are a type of form)
            else if (assetType.key === 'quizzes' && locationId) {
                sendProgressUpdate(84, `Enriching ${assets.length} quizzes...`);

                const enrichedQuizzes = await enrichForms(assets, locationId);
                // Filter to only include quizzes that exist in the original snapshot
                const filteredQuizzes = filterBySnapshotIds(enrichedQuizzes, assets);
                const sheetData = convertAssetTypeToArray(filteredQuizzes);
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

                const colWidths = sheetData[0].map(() => ({ wch: 20 }));
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Quizzes');
                sheetsCreated++;
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
            }
        } else {
            // Add to summary even if empty
            summaryData.push([assetType.name, 0, 'N/A']);
        }
    }

    // Process deferred Trigger Links last so reverse-lookup columns can reference
    // every other asset in the snapshot (workflows, forms, email templates, etc.).
    if (deferredSnapshotLinkAssets && deferredSnapshotLinkAssets.length > 0 && locationId) {
        sendProgressUpdate(88, `Enriching ${deferredSnapshotLinkAssets.length} trigger links...`);
        const enrichedLinksBase = await enrichLinks(deferredSnapshotLinkAssets, locationId);
        const filteredLinks = filterBySnapshotIds(enrichedLinksBase, deferredSnapshotLinkAssets);
        const enrichedLinks = addTriggerLinkReverseLookup(filteredLinks, snapshotData);
        const sheetData = convertAssetTypeToArray(enrichedLinks);
        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
        worksheet['!cols'] = sheetData[0].map(() => ({ wch: 20 }));
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Trigger_Links');
        sheetsCreated++;
    }

    // Add totals to summary
    summaryData.push([]);
    summaryData.push(['Total Assets', totalAssets]);
    summaryData.push(['Total Sheets', sheetsCreated + 1]); // +1 for master list

    // Create summary sheet
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

    // Add hyperlinks from Summary "Sheet Name" column to each data sheet
    // Data rows start after: title, snapshotId, name, locationId, type, created, updated, exportDate, format, blank, header = row 11
    const summaryDataStartRow = 11;
    for (let i = summaryDataStartRow; i < summaryData.length; i++) {
        const sheetLabel = summaryData[i][2]; // Sheet Name column
        if (!sheetLabel || sheetLabel === 'N/A') continue;
        const targetSheet = workbook.SheetNames.find(s =>
            s === sheetLabel || s === sheetLabel.replace(/ /g, '_')
        );
        if (!targetSheet) continue;
        const cellRef = XLSX.utils.encode_cell({ r: i, c: 2 });
        if (summarySheet[cellRef]) {
            summarySheet[cellRef].l = { Target: `#'${targetSheet}'!A1` };
        }
    }

    // Set column widths for summary
    summarySheet['!cols'] = [
        { wch: 40 },
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

    // Add hyperlinks to master list columns
    const sheetRowCounters = {};
    for (let row = 1; row < masterListData.length; row++) {
        const assetTypeName = masterListData[row][2];
        if (!assetTypeName) continue;

        const sheetName = workbook.SheetNames.find(s =>
            s === assetTypeName || s === assetTypeName.replace(/ /g, '_')
        );
        if (!sheetName) continue;

        // Track row counter per sheet (row 0 is header, data starts at row 1)
        if (!sheetRowCounters[sheetName]) sheetRowCounters[sheetName] = 1;
        const sheetRow = sheetRowCounters[sheetName]++;

        // Add hyperlink to "Type of Asset" column (column C) → sheet tab
        const typeCellRef = XLSX.utils.encode_cell({ r: row, c: 2 });
        if (masterListSheet[typeCellRef]) {
            masterListSheet[typeCellRef].l = { Target: `#'${sheetName}'!A1` };
        }

        // Add hyperlink to "ID" column (column A) → specific row in sheet
        // +3 offset accounts for the 3 header rows added to each sheet
        const idCellRef = XLSX.utils.encode_cell({ r: row, c: 0 });
        if (masterListSheet[idCellRef]) {
            masterListSheet[idCellRef].l = { Target: `#'${sheetName}'!A${sheetRow + 1 + 3}` };
        }

        // Add hyperlink to "Name" column (column B) → specific row in sheet
        const nameCellRef = XLSX.utils.encode_cell({ r: row, c: 1 });
        if (masterListSheet[nameCellRef]) {
            masterListSheet[nameCellRef].l = { Target: `#'${sheetName}'!A${sheetRow + 1 + 3}` };
        }
    }

    // Recreate workbook with proper sheet order
    const newWorkbook = XLSX.utils.book_new();

    // Add sheets in order: Summary, Master List, then all asset type sheets
    XLSX.utils.book_append_sheet(newWorkbook, summarySheet, 'Summary');
    XLSX.utils.book_append_sheet(newWorkbook, masterListSheet, 'Master List');

    // Add all other sheets. In AI-friendly mode, skip the 3-row sheet header
    // prepend so each sheet starts directly with its column header row.
    workbook.SheetNames.forEach(sheetName => {
        if (sheetName !== 'Summary') {
            if (!_aiFriendlyMode) {
                addSheetHeader(workbook.Sheets[sheetName], sheetName, exportDate);
            }
            XLSX.utils.book_append_sheet(newWorkbook, workbook.Sheets[sheetName], sheetName);
        }
    });

    // Apply professional styling to the entire workbook (skipped in AI-friendly mode)
    if (!_aiFriendlyMode) {
        applyWorkbookStyles(newWorkbook);
    }

    return newWorkbook;
}

/**
 * Filter enriched assets to only include those with IDs present in the original snapshot data.
 * This ensures that assets from the subaccount that are not part of the snapshot are excluded.
 * @param {Array} enrichedAssets - The array of enriched assets (from subaccount API)
 * @param {Array} originalSnapshotAssets - The original snapshot assets (contains the IDs that belong to the snapshot)
 * @returns {Array} Filtered array containing only assets whose IDs exist in the original snapshot
 */
function filterBySnapshotIds(enrichedAssets, originalSnapshotAssets) {
    if (!enrichedAssets || !originalSnapshotAssets) {
        return enrichedAssets || [];
    }

    // Extract IDs from original snapshot assets
    const snapshotIds = new Set();
    originalSnapshotAssets.forEach(asset => {
        const id = asset._id || asset.id || asset.ID;
        if (id) {
            snapshotIds.add(id);
        }
    });

    // Filter enriched assets to only include those with IDs in the snapshot
    const filtered = enrichedAssets.filter(asset => {
        const id = asset._id || asset.id || asset.ID;
        return id && snapshotIds.has(id);
    });

    const removedCount = enrichedAssets.length - filtered.length;
    if (removedCount > 0) {
    }

    return filtered;
}

/**
 * Add sheet header rows (export info + back-to-summary link) to a worksheet.
 * Shifts existing rows down by 3 to make room for:
 *   Row 1: "← Back to Summary" hyperlink
 *   Row 2: "Sheet: <name>  |  Exported: <date/time>"
 *   Row 3: blank separator
 * Then original data (headers + rows) starts at row 4.
 */
function addSheetHeader(worksheet, sheetDisplayName, exportDate) {
    if (!worksheet) return worksheet;

    const dateStr = exportDate || new Date().toISOString();
    const headerRows = [
        ['← Back to Summary'],
        [`Sheet: ${sheetDisplayName}  |  Exported: ${dateStr}`],
        []
    ];
    const insertCount = headerRows.length;

    // Decode the worksheet range
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

    // Shift all existing cells down by insertCount rows
    for (let r = range.e.r; r >= range.s.r; r--) {
        for (let c = range.s.c; c <= range.e.c; c++) {
            const oldRef = XLSX.utils.encode_cell({ r, c });
            const newRef = XLSX.utils.encode_cell({ r: r + insertCount, c });
            if (worksheet[oldRef]) {
                worksheet[newRef] = worksheet[oldRef];
                delete worksheet[oldRef];
            }
        }
    }

    // Write header rows into the newly freed rows
    for (let r = 0; r < headerRows.length; r++) {
        for (let c = 0; c < headerRows[r].length; c++) {
            const cellRef = XLSX.utils.encode_cell({ r, c });
            worksheet[cellRef] = { t: 's', v: headerRows[r][c] };
        }
    }

    // Add hyperlink on "← Back to Summary" cell
    const backCellRef = XLSX.utils.encode_cell({ r: 0, c: 0 });
    if (worksheet[backCellRef]) {
        worksheet[backCellRef].l = { Target: "#'Summary'!A1" };
    }

    // Update the range to include the new header rows
    range.e.r += insertCount;
    worksheet['!ref'] = XLSX.utils.encode_range(range);

    // Shift any existing merge ranges down
    if (worksheet['!merges']) {
        worksheet['!merges'] = worksheet['!merges'].map(m => ({
            s: { r: m.s.r + insertCount, c: m.s.c },
            e: { r: m.e.r + insertCount, c: m.e.c }
        }));
    }

    return worksheet;
}

// ── Excel Styling Constants ──────────────────────────────────────────────────
const STYLE = {
    // Super Snapshot AI brand palette — purple/violet
    PRIMARY:     '6B21A8',  // Deep purple
    PRIMARY_LT:  '7C3AED',  // Medium violet
    ACCENT:      '8B5CF6',  // Bright violet for buttons/links
    ACCENT_LT:   'F3E8FF',  // Very light purple tint
    HEADER_BG:   '6B21A8',  // Deep purple for table headers
    ROW_ALT:     'FAF5FF',  // Light lavender for alternating rows
    ROW_WHITE:   'FFFFFF',
    TITLE_BG:    '581C87',  // Darkest purple for title rows
    BACK_BTN:    '7C3AED',  // Violet for "Back to Summary" button
    LINK_BTN:    '8B5CF6',  // Bright violet for hyperlink buttons
    BORDER:      'DDD6FE',  // Light purple border
    BORDER_HDR:  '4C1D95',  // Dark purple border for headers
    TEXT_DARK:   '1E1B4B',  // Deep indigo-black
    TEXT_WHITE:  'FFFFFF',
    TEXT_MUTED:  '6B7280',
    SUMMARY_KV:  'EDE9FE',  // Light violet for summary key-value rows
};

const THIN_BORDER = { style: 'thin', color: { rgb: STYLE.BORDER } };
const BORDER_ALL = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
const BORDER_HEADER = {
    top:    { style: 'thin', color: { rgb: STYLE.BORDER_HDR } },
    bottom: { style: 'medium', color: { rgb: STYLE.BORDER_HDR } },
    left:   { style: 'thin', color: { rgb: STYLE.BORDER_HDR } },
    right:  { style: 'thin', color: { rgb: STYLE.BORDER_HDR } }
};

/**
 * Apply professional styling to an entire workbook.
 * Call this on the final workbook right before writing/downloading.
 */
function applyWorkbookStyles(workbook) {
    workbook.SheetNames.forEach(name => {
        const ws = workbook.Sheets[name];
        if (!ws || !ws['!ref']) return;

        if (name === 'Summary') {
            styleSummarySheet(ws);
        } else if (name === 'Master List') {
            styleMasterListSheet(ws);
        } else {
            styleDataSheet(ws);
        }
    });
}

/**
 * Style the Summary sheet: title, key-value pairs, asset table with hyperlink buttons
 */
function styleSummarySheet(ws) {
    const range = XLSX.utils.decode_range(ws['!ref']);

    // Find the header row (contains "Asset Type", "Count", "Sheet Name")
    let headerRow = -1;
    for (let r = range.s.r; r <= range.e.r; r++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
        if (cell && String(cell.v).toLowerCase() === 'asset type') {
            headerRow = r;
            break;
        }
    }

    for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
            const ref = XLSX.utils.encode_cell({ r, c });
            if (!ws[ref]) continue;

            // Row 0: Title row
            if (r === 0) {
                ws[ref].s = {
                    font: { bold: true, sz: 16, color: { rgb: STYLE.TEXT_WHITE } },
                    fill: { fgColor: { rgb: STYLE.TITLE_BG } },
                    alignment: { horizontal: 'left', vertical: 'center' },
                    border: BORDER_ALL
                };
            }
            // Key-value metadata rows (before the header row)
            else if (headerRow > 0 && r > 0 && r < headerRow - 1) {
                if (c === 0) {
                    ws[ref].s = {
                        font: { bold: true, sz: 11, color: { rgb: STYLE.PRIMARY } },
                        fill: { fgColor: { rgb: STYLE.SUMMARY_KV } },
                        border: BORDER_ALL,
                        alignment: { vertical: 'center' }
                    };
                } else {
                    ws[ref].s = {
                        font: { sz: 11, color: { rgb: STYLE.TEXT_DARK } },
                        fill: { fgColor: { rgb: STYLE.ROW_WHITE } },
                        border: BORDER_ALL,
                        alignment: { vertical: 'center' }
                    };
                }
            }
            // Asset table header row
            else if (r === headerRow) {
                ws[ref].s = {
                    font: { bold: true, sz: 11, color: { rgb: STYLE.TEXT_WHITE } },
                    fill: { fgColor: { rgb: STYLE.HEADER_BG } },
                    border: BORDER_HEADER,
                    alignment: { horizontal: 'center', vertical: 'center' }
                };
            }
            // Asset table data rows
            else if (headerRow > 0 && r > headerRow) {
                const isAlt = (r - headerRow) % 2 === 0;
                const bgColor = isAlt ? STYLE.ROW_ALT : STYLE.ROW_WHITE;

                // Sheet Name column with hyperlink → button style
                if (c === 2 && ws[ref].l) {
                    ws[ref].s = {
                        font: { bold: true, sz: 11, color: { rgb: STYLE.TEXT_WHITE }, underline: true },
                        fill: { fgColor: { rgb: STYLE.LINK_BTN } },
                        border: BORDER_ALL,
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // Count column - center aligned
                else if (c === 1) {
                    ws[ref].s = {
                        font: { sz: 11, color: { rgb: STYLE.TEXT_DARK } },
                        fill: { fgColor: { rgb: bgColor } },
                        border: BORDER_ALL,
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // Total/summary rows (bold)
                else if (String(ws[ref].v).startsWith('Total') || String(ws[ref].v).startsWith('Sheets')) {
                    ws[ref].s = {
                        font: { bold: true, sz: 11, color: { rgb: STYLE.PRIMARY } },
                        fill: { fgColor: { rgb: STYLE.ACCENT_LT } },
                        border: BORDER_ALL,
                        alignment: { vertical: 'center' }
                    };
                }
                else {
                    ws[ref].s = {
                        font: { sz: 11, color: { rgb: STYLE.TEXT_DARK } },
                        fill: { fgColor: { rgb: bgColor } },
                        border: BORDER_ALL,
                        alignment: { vertical: 'center' }
                    };
                }
            }
        }
    }

    // Set row heights
    if (!ws['!rows']) ws['!rows'] = [];
    ws['!rows'][0] = { hpt: 30 }; // Title row taller
    if (headerRow > 0) ws['!rows'][headerRow] = { hpt: 24 };
}

/**
 * Style the Master List sheet: header row, alternating rows, hyperlink buttons
 */
function styleMasterListSheet(ws) {
    const range = XLSX.utils.decode_range(ws['!ref']);

    for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
            const ref = XLSX.utils.encode_cell({ r, c });
            if (!ws[ref]) continue;

            // Header row
            if (r === 0) {
                ws[ref].s = {
                    font: { bold: true, sz: 11, color: { rgb: STYLE.TEXT_WHITE } },
                    fill: { fgColor: { rgb: STYLE.HEADER_BG } },
                    border: BORDER_HEADER,
                    alignment: { horizontal: 'center', vertical: 'center' }
                };
            }
            // Data rows
            else {
                const isAlt = r % 2 === 0;
                const bgColor = isAlt ? STYLE.ROW_ALT : STYLE.ROW_WHITE;

                // Hyperlinked cells → button style
                if (ws[ref].l) {
                    ws[ref].s = {
                        font: { bold: true, sz: 10, color: { rgb: STYLE.TEXT_WHITE }, underline: true },
                        fill: { fgColor: { rgb: STYLE.LINK_BTN } },
                        border: BORDER_ALL,
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                } else {
                    ws[ref].s = {
                        font: { sz: 10, color: { rgb: STYLE.TEXT_DARK } },
                        fill: { fgColor: { rgb: bgColor } },
                        border: BORDER_ALL,
                        alignment: { vertical: 'center' }
                    };
                }
            }
        }
    }

    if (!ws['!rows']) ws['!rows'] = [];
    ws['!rows'][0] = { hpt: 24 };
}

/**
 * Style a data sheet: "Back to Summary" button, sheet info row, table headers, alternating rows
 */
function styleDataSheet(ws) {
    const range = XLSX.utils.decode_range(ws['!ref']);

    // Row 0 = "← Back to Summary" (hyperlink button)
    // Row 1 = "Sheet: ... | Exported: ..."
    // Row 2 = blank separator
    // Row 3 = data headers
    const dataHeaderRow = 3;

    for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
            const ref = XLSX.utils.encode_cell({ r, c });
            if (!ws[ref]) continue;

            // "← Back to Summary" button
            if (r === 0 && c === 0) {
                ws[ref].s = {
                    font: { bold: true, sz: 11, color: { rgb: STYLE.TEXT_WHITE }, underline: true },
                    fill: { fgColor: { rgb: STYLE.BACK_BTN } },
                    border: BORDER_ALL,
                    alignment: { horizontal: 'center', vertical: 'center' }
                };
            }
            // Sheet info row
            else if (r === 1) {
                ws[ref].s = {
                    font: { italic: true, sz: 10, color: { rgb: STYLE.TEXT_MUTED } },
                    alignment: { vertical: 'center' }
                };
            }
            // Data header row
            else if (r === dataHeaderRow) {
                ws[ref].s = {
                    font: { bold: true, sz: 11, color: { rgb: STYLE.TEXT_WHITE } },
                    fill: { fgColor: { rgb: STYLE.HEADER_BG } },
                    border: BORDER_HEADER,
                    alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
                };
            }
            // Data rows
            else if (r > dataHeaderRow) {
                const isAlt = (r - dataHeaderRow) % 2 === 0;
                const bgColor = isAlt ? STYLE.ROW_ALT : STYLE.ROW_WHITE;

                // Hyperlinked cells (e.g. "Open in GHL") get a button style
                // so the link is visually obvious; falls back to plain row styling otherwise.
                if (ws[ref].l) {
                    ws[ref].s = {
                        font: { bold: true, sz: 10, color: { rgb: STYLE.TEXT_WHITE }, underline: true },
                        fill: { fgColor: { rgb: STYLE.LINK_BTN } },
                        border: BORDER_ALL,
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                } else {
                    ws[ref].s = {
                        font: { sz: 10, color: { rgb: STYLE.TEXT_DARK } },
                        fill: { fgColor: { rgb: bgColor } },
                        border: BORDER_ALL,
                        alignment: { vertical: 'center', wrapText: false }
                    };
                }
            }
        }
    }

    // Set row heights
    if (!ws['!rows']) ws['!rows'] = [];
    ws['!rows'][0] = { hpt: 28 }; // Back button row
    if (range.e.r >= dataHeaderRow) {
        ws['!rows'][dataHeaderRow] = { hpt: 24 }; // Header row
    }
}

/**
 * Convert asset type to 2D array for Excel
 * @param {Array} assets - Array of asset objects
 * Uses module-level _includeFullEnrichmentData setting to determine if JSON column is included
 */
function convertAssetTypeToArray(assets) {
    if (!assets || assets.length === 0) {
        return [['No data']];
    }

    // Get all unique keys from all assets
    const allKeys = new Set();
    assets.forEach(asset => {
        Object.keys(asset).forEach(key => {
            // Exclude fullEnrichmentData from regular columns - it will be added at the end if enabled
            if (key !== 'fullEnrichmentData') {
                allKeys.add(key);
            }
        });
    });

    // Convert to array and sort, with 'id' and 'name' prioritized first
    let headers = Array.from(allKeys);

    // Check which priority fields exist
    const hasId = headers.includes('id');
    const hasName = headers.includes('name');
    const has_Id = headers.includes('_id');
    const hasAgentName = headers.includes('agentName');

    // Remove priority fields from the array using filter to avoid index shifting issues
    headers = headers.filter(h => h !== 'id' && h !== 'name' && h !== '_id' && h !== 'agentName');

    // Sort remaining headers
    headers.sort();

    // Prepend priority fields at the beginning in order: id/_id, name/agentName
    const priorityHeaders = [];
    if (hasId || has_Id) {
        // Prefer 'id' over '_id', but use whichever exists
        priorityHeaders.push(hasId ? 'id' : '_id');
    }
    if (hasName) {
        priorityHeaders.push('name');
    } else if (hasAgentName) {
        // Use agentName as fallback if name doesn't exist (e.g., Voice AI Agents)
        priorityHeaders.push('agentName');
    }

    headers = [...priorityHeaders, ...headers];

    // Add "Full Enrichment Data" as the last column only if enabled (uses module-level setting)
    if (_includeFullEnrichmentData) {
        headers.push('Full Enrichment Data');
    }

    // Format headers for display: camelCase/snake_case → UPPER TITLE CASE
    const displayHeaders = headers.map(h => {
        if (h === 'Full Enrichment Data') return h.toUpperCase();
        return h
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[_-]/g, ' ')
            .toUpperCase();
    });

    // Create data array starting with formatted headers
    const dataArray = [displayHeaders];

    // Add data rows
    assets.forEach(asset => {
        const row = headers.map(header => {
            if (header === 'Full Enrichment Data') {
                // Return the full enrichment data as JSON string, truncated to Excel limit
                const jsonString = asset.fullEnrichmentData ? JSON.stringify(asset.fullEnrichmentData, null, 2) : '';
                return truncateToExcelLimit(jsonString);
            }
            // Normalize ID field - check both 'id' and '_id' for ID columns
            if (header === 'id' || header === '_id') {
                const value = asset.id || asset._id;
                return formatValueForExcel(value);
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

    } catch (error) {
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
        { key: 'media', name: 'Media' },
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

    } catch (error) {
        throw error;
    }
}

/**
 * Estimate export time based on asset counts
 * @param {Object} snapshotData - The snapshot data containing all assets
 * @returns {Object} - Estimated time in seconds and formatted string
 */
function estimateExportTime(snapshotData) {
    // Base time in seconds
    let estimatedSeconds = 10; // Base overhead for authentication, downloading, etc.

    // Time estimates per asset type (in seconds per item)
    const timePerAsset = {
        'workflow': 2,          // Workflows with AI analysis take longer
        'funnels': 15,          // Funnels are the slowest - multiple API calls per funnel, per page
        'forms': 1,             // Forms need enrichment
        'surveys': 0.5,
        'calendars': 1,
        'campaigns': 0.3,
        'pipelines': 0.5,
        'custom_fields': 0.1,
        'custom_values': 0.1,
        'tags': 0.1,
        'text_templates': 0.2,
        'email_templates': 0.2,
        'links': 0.1,
        'folders': 0.1,
        'media': 0.1,
        'teams': 0.2,
        'membership_offers': 0.3,
        'membership_products': 0.3,
        'triggers': 0.3,
        'knowledge_bases': 2,        // Knowledge bases now fetch details, files, URLs, FAQs, rich text, operations
        'quizzes': 0.5,
        'dashboards': 0.5,
        'custom_objects': 0.3,
        'certificates': 0.2,
        'review_settings': 0.2,
        'conversation_ai': 0.5,
        'social_planner': 0.3,
        'sectionTemplates': 0.2,
        'voice_ai_agents': 1,     // Voice AI agents need individual API calls for full details
        'ai_employees': 0.5,      // AI employees enrichment is faster
        'documents': 0.2,         // Documents/contracts templates
        'snippets': 0.1,          // Snippets are simple text templates
        'objects': 0.1            // Objects are simple definitions
    };

    // Calculate time for each asset type
    for (const [assetType, timePerItem] of Object.entries(timePerAsset)) {
        const assets = snapshotData[assetType];
        if (assets && assets.length > 0) {
            estimatedSeconds += assets.length * timePerItem;
        }
    }

    // Format the time string
    let timeString = '';
    if (estimatedSeconds < 60) {
        timeString = `~${Math.ceil(estimatedSeconds)} seconds`;
    } else if (estimatedSeconds < 3600) {
        const minutes = Math.ceil(estimatedSeconds / 60);
        timeString = `~${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
        const hours = Math.floor(estimatedSeconds / 3600);
        const minutes = Math.ceil((estimatedSeconds % 3600) / 60);
        timeString = `~${hours} hour${hours > 1 ? 's' : ''}`;
        if (minutes > 0) {
            timeString += ` ${minutes} min`;
        }
    }

    return {
        seconds: estimatedSeconds,
        formatted: timeString
    };
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
                    companyId = await window.ghlUtilsRevex.getLocationId();
                } catch (e) {
                }
            }

            // Fallback to Chrome storage
            if (!companyId) {
                const result = await chrome.storage.local.get(['companyId', 'locationId']);
                companyId = result.companyId || result.locationId;
                if (companyId) {
                }
            }

            if (!companyId) {
                throw new Error('Company ID not found. Please provide it manually or ensure you are on a GHL page.');
            }

            return { snapshotId, companyId };
        }

        throw new Error('Could not detect snapshot ID from page URL');
    } catch (error) {
        throw error;
    }
}

/**
 * Export snapshot from current page
 */
async function exportCurrentSnapshot() {
    try {
        const { snapshotId, companyId } = await getCurrentSnapshotInfo();
        return await exportSnapshotAssets(snapshotId, companyId);
    } catch (error) {
        throw error;
    }
}

/**
 * Export snapshot with custom IDs (called from popup)
 */
async function exportSnapshotWithIds(snapshotId, companyId, format = 'xlsx', selectedAssets = null) {
    if (!snapshotId || !companyId) {
        throw new Error('Snapshot ID and Company ID are required');
    }

    return await exportSnapshotAssets(snapshotId, companyId, 'own', format, selectedAssets);
}

/**
 * Get company ID from current user
 */
async function getCompanyIdFromUser() {
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

        // Ensure revex is ready
        if (!window.ghlUtilsRevex) {
            throw new Error('Revex authentication not available');
        }

        await window.ghlUtilsRevex.waitForReady();

        // Fetch user data
        const endpoint = `/users/${userId}`;
        const response = await window.ghlUtilsRevex.get(endpoint);

        if (!response || !response.data) {
            throw new Error('Failed to fetch user data');
        }

        const userData = response.data;
        if (!userData.companyId) {
            throw new Error('Company ID not found in user data');
        }

        return { success: true, companyId: userData.companyId };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Fetch snapshots list for company
 */
async function fetchSnapshotsList(companyId) {
    try {
        // If no companyId provided, try to get from user
        if (!companyId) {
            const result = await getCompanyIdFromUser();
            if (!result.success) {
                throw new Error(result.error);
            }
            companyId = result.companyId;
        }

        // Ensure revex is ready
        if (!window.ghlUtilsRevex) {
            throw new Error('Revex authentication not available');
        }

        await window.ghlUtilsRevex.waitForReady();

        // Fetch snapshots list
        const endpoint = `/snapshots/v2/${companyId}?companyId=${companyId}&skip=0&limit=20&type=own`;
        const response = await window.ghlUtilsRevex.get(endpoint);

        if (!response || !response.data) {
            throw new Error('Failed to fetch snapshots list');
        }

        const snapshotsData = response.data;
        // Extract snapshots array (API might return { snapshots: [...] } or { data: [...] })
        let snapshots = snapshotsData.snapshots || snapshotsData.data || snapshotsData;

        // Ensure it's an array
        if (!Array.isArray(snapshots)) {
            snapshots = [];
        }

        return { success: true, snapshots: snapshots, companyId: companyId };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Listen for messages from popup (Chrome extension messages)
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    // Handle GHL page detection check
    if (request.action === 'checkGHLPage') {
        // Direct detection: check URL and domain (fast and reliable)
        const urlMatch = window.location.href.match(/\/location\/([A-Za-z0-9_-]{18,28})/);
        const urlLocationId = urlMatch ? urlMatch[1] : null;

        const hostname = window.location.hostname;
        const isGHLDomain = hostname.includes('gohighlevel.com') ||
                           hostname.includes('leadconnectorhq.com') ||
                           hostname.includes('highlevel.com');

        // It's a GHL page if we found a locationId in URL OR it's a known GHL domain
        const isGHLPage = !!urlLocationId || isGHLDomain;

        // If it's a GHL page, try to get additional data from revex (for agency admin company fallback)
        if (isGHLPage && window.ghlUtilsRevex && window.ghlUtilsRevex.waitForGHLDetection) {
            window.ghlUtilsRevex.waitForGHLDetection(3000)
                .then(result => {
                    // Use URL locationId first, then revex detection result
                    const finalLocationId = urlLocationId || result.locationId;
                    sendResponse({
                        success: true,
                        isGHLPage: true,
                        hasAuthToken: result.hasAuthToken,
                        locationId: finalLocationId
                    });
                })
                .catch(error => {
                    // Fall back to URL detection only
                    sendResponse({
                        success: true,
                        isGHLPage: true,
                        hasAuthToken: false,
                        locationId: urlLocationId
                    });
                });
        } else if (isGHLPage) {
            // GHL page but revex not available yet - use direct detection
            let finalLocationId = urlLocationId;
            if (!finalLocationId && window.ghlUtilsRevex && window.ghlUtilsRevex.getLocationId) {
                finalLocationId = window.ghlUtilsRevex.getLocationId();
            }
            sendResponse({
                success: true,
                isGHLPage: true,
                hasAuthToken: false,
                locationId: finalLocationId
            });
        } else {
            // Not a GHL page
            sendResponse({
                success: true,
                isGHLPage: false,
                hasAuthToken: false,
                locationId: null
            });
        }
        return true; // Will respond asynchronously
    }

    if (request.action === 'exportLocationAssets') {
        exportLocationAssets(request.locationId, request.format || 'xlsx+html', request.selectedAssets)
            .then(result => {
                sendResponse({ success: true, result });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true; // Will respond asynchronously
    }

    return false;
});

// Listen for custom events from page context (page-exporter.js)
document.addEventListener('ghl-snapshot-export', async (event) => {
    const { action, snapshotId, companyId, locationId, format, selectedAssets } = event.detail;

    try {
        let result;

        if (action === 'exportCurrentSnapshot') {
            result = await exportCurrentSnapshot();
        } else if (action === 'exportSnapshotWithIds') {
            result = await exportSnapshotWithIds(snapshotId, companyId, format || 'xlsx', selectedAssets);
        } else if (action === 'exportLocationAssets') {
            result = await exportLocationAssets(locationId, format || 'xlsx+html', selectedAssets);
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

/**
 * Analyze workflow with AI to generate description and setup notes
 * @param {Object} workflowData - Full workflow data from API
 * @returns {Promise<Object>} - { description, setupNotes }
 */
async function analyzeWorkflowWithAI(workflowData) {
    try {
        // Get OpenAI API key and AI settings from storage
        const result = await chrome.storage.local.get(['openaiApiKey', 'aiAnalysisEnabled']);
        const apiKey = result.openaiApiKey;
        const aiEnabled = result.aiAnalysisEnabled === true;

        if (!aiEnabled) {
            return {
                description: '',
                setupNotes: ''
            };
        }

        if (!apiKey) {
            return {
                description: '',
                setupNotes: ''
            };
        }

        // Build the prompt
        const prompt = buildWorkflowAnalysisPrompt(workflowData);

        // Call OpenAI API via background script (has unrestricted fetch access)
        const systemPrompt = `You are an expert GoHighLevel (GHL) workflow analyst. Your task is to analyze workflows and create concise documentation for asset management.

Focus on:
1. What the workflow does (its purpose and key actions)
2. What needs to be configured or customized (setup instructions)

Be specific about:
- Triggers and conditions
- Tags, custom fields, pipelines used
- Messages sent (SMS/Email)
- User assignments and notifications
- Any required customizations`;

        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'callOpenAI',
                apiKey: apiKey,
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                maxTokens: 500
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });

        if (!response || !response.success) {
            const errorMsg = response?.error || 'Unknown error';
            throw new Error(errorMsg);
        }

        const aiResponse = response.data.choices[0]?.message?.content || '';

        // Parse the response
        const parsed = parseAIWorkflowResponse(aiResponse);
        return parsed;

    } catch (error) {
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
 * @param {string} companyId - Company/Location ID (optional if locationId provided)
 * @param {string} snapshotId - Snapshot ID (optional if locationId provided)
 * @param {string} providedLocationId - Optional locationId for direct location exports
 * @returns {Promise<Array>} - Enriched workflows with AI analysis
 */
async function enrichWorkflowsWithAI(workflows, companyId, snapshotId, providedLocationId = null) {
    // Check if AI is enabled
    const aiSettings = await chrome.storage.local.get(['aiAnalysisEnabled', 'openaiApiKey']);
    const aiEnabled = aiSettings.aiAnalysisEnabled === true && aiSettings.openaiApiKey;

    if (aiEnabled) {
    } else {
    }

    let locationId = providedLocationId;

    // If locationId not provided directly, fetch from snapshot details
    if (!locationId && snapshotId && companyId) {
        const snapshotDetailsEndpoint = `/snapshots/snapshotDetails/${snapshotId}?companyId=${companyId}`;

        try {
            await window.ghlUtilsRevex.waitForReady();
            const snapshotDetailsResponse = await window.ghlUtilsRevex.get(snapshotDetailsEndpoint);

            if (snapshotDetailsResponse && snapshotDetailsResponse.data && snapshotDetailsResponse.data.locationId) {
                locationId = snapshotDetailsResponse.data.locationId;
            } else {
                throw new Error('No locationId found in snapshot details');
            }
        } catch (error) {
            throw error;
        }
    } else if (locationId) {
    } else {
        throw new Error('No locationId provided and no snapshotId/companyId to fetch it from');
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

    let processedCount = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
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

            try {
                // Fetch full workflow data using locationId
                const endpoint = `/workflow/${locationId}/${workflowId}?includeScheduledPauseInfo=true`;
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
                        if (attempts < maxAttempts && error.message.includes('401')) {
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        } else {
                            throw error;
                        }
                    }
                }

                const fullWorkflowData = response.data;
                const templates = fullWorkflowData.workflowData?.templates || [];

                // Run AI analysis only if enabled
                let aiAnalysis = { description: '', setupNotes: '' };
                if (aiEnabled) {
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
                return { workflowDetails, workflowDuration };

            } catch (error) {
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
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    const totalTime = Date.now() - startTime;
    const avgTime = timePerWorkflow.length > 0 ? timePerWorkflow.reduce((a, b) => a + b, 0) / timePerWorkflow.length : 0;
    return enrichedWorkflows;
}

/**
 * Fetch workflow triggers for all workflows
 * Creates a separate dataset of trigger configurations
 */
async function fetchWorkflowTriggers(workflows, locationId) {
    if (!workflows || workflows.length === 0 || !locationId) {
        return [];
    }

    const allTriggers = [];

    try {
        await window.ghlUtilsRevex.waitForReady();

        for (let i = 0; i < workflows.length; i++) {
            const workflow = workflows[i];
            const workflowId = workflow.id || workflow._id;
            const workflowName = workflow.name || 'Unnamed Workflow';

            if (!workflowId) {
                continue;
            }

            try {
                const endpoint = `/workflow/${locationId}/trigger?workflowId=${workflowId}`;
                const response = await window.ghlUtilsRevex.get(endpoint);

                // Response is an array of triggers
                let triggers = [];
                if (Array.isArray(response?.data)) {
                    triggers = response.data;
                } else if (Array.isArray(response)) {
                    triggers = response;
                } else if (response?.data?.triggers && Array.isArray(response.data.triggers)) {
                    triggers = response.data.triggers;
                }

                // Process each trigger
                triggers.forEach(trigger => {
                    const enrichedTrigger = {
                        // Trigger identification
                        id: trigger.id || trigger._id || '',
                        name: trigger.name || '',
                        type: trigger.type || '',
                        masterType: trigger.masterType || '',
                        // Status
                        active: trigger.active !== undefined ? trigger.active : false,
                        deleted: trigger.deleted !== undefined ? trigger.deleted : false,
                        // Workflow association
                        workflowId: trigger.workflow_id || workflowId,
                        workflowName: workflowName,
                        belongsTo: trigger.belongs_to || 'workflow',
                        // Conditions
                        hasConditions: trigger.conditions && trigger.conditions.length > 0,
                        conditionCount: trigger.conditions ? trigger.conditions.length : 0,
                        conditions: trigger.conditions ? trigger.conditions.map(c => {
                            return `${c.field || c.title || ''} ${c.operator || ''} ${c.value || ''}`.trim();
                        }).join('; ') : '',
                        conditionFields: trigger.conditions ? trigger.conditions.map(c => c.field || c.title).filter(Boolean).join('; ') : '',
                        // Actions
                        hasActions: trigger.actions && trigger.actions.length > 0,
                        actionCount: trigger.actions ? trigger.actions.length : 0,
                        actionTypes: trigger.actions ? trigger.actions.map(a => a.type).filter(Boolean).join('; ') : '',
                        // Origin and location
                        locationId: trigger.location_id || locationId,
                        originId: trigger.origin_id || '',
                        // Dates
                        dateAdded: trigger.date_added || '',
                        dateUpdated: trigger.date_updated || '',
                        // Full data
                        fullEnrichmentData: _includeFullEnrichmentData ? trigger : undefined
                    };

                    allTriggers.push(enrichedTrigger);
                });

                // Small delay to avoid rate limiting
                if (i < workflows.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            } catch (error) {
            }
        }

    } catch (error) {
    }

    return allTriggers;
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

    templates.forEach((template) => {
        const attrs = template.attributes || {};

        // Check for fields array in attributes (update_contact_field actions)
        if (attrs.fields && Array.isArray(attrs.fields)) {
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
            // Match {{contact.field_name}} patterns
            const customFieldMatches = searchableContent.matchAll(/\{\{contact\.([a-zA-Z0-9_]+)\}\}/g);
            for (const match of customFieldMatches) {
                const fieldName = match[1];
                // Exclude standard contact fields
                if (!['first_name', 'last_name', 'email', 'phone', 'name', 'id'].includes(fieldName)) {
                    fields.add(fieldName);
                }
            }

            // Match {{contact.custom_fields.field_name}} patterns
            const customFieldsMatches = searchableContent.matchAll(/\{\{contact\.custom_fields\.([a-zA-Z0-9_]+)\}\}/g);
            for (const match of customFieldsMatches) {
                fields.add(match[1]);
            }
        }

        // Check for update_custom_field or update_contact_field actions
        if (template.type === 'update_custom_field' ||
            template.type === 'set_custom_field' ||
            template.type === 'update_contact_field') {
            if (attrs.fieldId) fields.add(attrs.fieldId);
            if (attrs.fieldKey) fields.add(attrs.fieldKey);
            if (attrs.fieldName) fields.add(attrs.fieldName);
        }
    });

    return Array.from(fields).filter(Boolean).join('; ');
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
                return isMainCondition;
            }
            return false;
        });
        return matches.length;
    }

    const matches = templates.filter(t => {
        const templateType = (t.type || '').toLowerCase();
        const searchType = actionType.toLowerCase();
        return templateType === searchType || templateType.includes(searchType);
    });

    return matches.length;
}

/**
 * Enrich forms with full details
 */
async function enrichForms(forms, locationId) {
    if (!forms || forms.length === 0 || !locationId) {
        return forms;
    }

    const enrichedForms = [];

    for (let i = 0; i < forms.length; i++) {
        const form = forms[i];
        const formId = form._id || form.id;
        const formName = form.name || 'Unnamed Form';

        try {
            // Use the new services endpoint for detailed form data
            const endpoint = `/forms/${formId}`;
            await window.ghlUtilsRevex.waitForReady();
            const response = await window.ghlUtilsRevex.get(endpoint, 'services');

            if (!response || !response.data || !response.data.form) {
                enrichedForms.push(form);
                continue;
            }

            const fullFormData = response.data.form;
            const formData = fullFormData.formData || {};
            const formConfig = formData.form || {};
            const fields = formConfig.fields || [];

            const enrichedForm = {
                ...form,
                productType: fullFormData.productType || '',
                deleted: fullFormData.deleted || false,
                version: fullFormData.version || 0,
                dateAdded: fullFormData.dateAdded || '',
                dateUpdated: fullFormData.dateUpdated || '',
                updatedAt: fullFormData.updatedAt || '',

                // Form configuration
                autoResponder: formData.autoResponder || false,
                emailNotifications: formData.emailNotifications || false,
                enablePartialContactCreation: formData.enablePartialContactCreation || false,

                // Branding
                companyName: formConfig.company?.name || '',
                companyLogoURL: formConfig.company?.logoURL || '',

                // Form action settings
                formActionType: formConfig.formAction?.actionType || '',
                thankyouText: formConfig.formAction?.thankyouText || '',
                redirectUrl: formConfig.formAction?.redirectUrl || '',
                headerImageSrc: formConfig.formAction?.headerImageSrc || '',

                // Fields
                totalFields: fields.length,
                fieldTypes: fields.map(f => f.type).join('; '),
                requiredFields: fields.filter(f => f.required).length,

                // Styling
                currentThemeId: formConfig.currentThemeId || '',
                backgroundColor: formConfig.style?.background || '',
                bgImage: formConfig.style?.bgImage || '',

                // Tracking
                fbPixelId: formConfig.fbPixelId || '',
                pixelId: formConfig.pixelId || '',

                // Compliance
                stickyContact: formConfig.stickyContact || false,
                isGDPRCompliant: formConfig.isGDPRCompliant || false,

                // Folder organization
                parentFolderId: formData.parentFolderId || '',
                parentFolderName: formData.parentFolderName || '',

                // Download URL
                formDataDownloadUrl: formData.formDataDownloadUrl || '',

                fullEnrichmentData: fullFormData
            };

            enrichedForms.push(enrichedForm);
        } catch (error) {
            enrichedForms.push(form);
        }
    }

    return enrichedForms;
}

/**
 * Fetch funnel page list with version history
 */
async function fetchFunnelPageList(funnelId, locationId) {
    try {
        const endpoint = `/funnels/page/list?funnelId=${funnelId}&locationId=${locationId}`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);
        const data = response.data;
        return Array.isArray(data) ? data : [];
    } catch (error) {
        return [];
    }
}

/**
 * Fetch funnel step details
 */
async function fetchFunnelStepDetails(funnelId, locationId, stepId) {
    try {
        const endpoint = `/funnels/lookup/list?funnelId=${funnelId}&locationId=${locationId}&typeId=${stepId}`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);
        const data = response.data;
        return data.data || [];
    } catch (error) {
        return [];
    }
}

/**
 * Fetch funnel page builder details
 */
async function fetchFunnelPageBuilderData(pageId) {
    try {
        const endpoint = `/funnels/builder/page/data?pageId=${pageId}`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);
        return response.data;
    } catch (error) {
        return null;
    }
}

/**
 * Count elements in page builder data
 */
function countPageElements(builderData) {
    if (!builderData || !builderData.sections) {
        return {};
    }

    const counts = {
        sections: 0,
        rows: 0,
        columns: 0,
        elements: 0,
        buttons: 0,
        images: 0,
        paragraphs: 0,
        headings: 0,
        subHeadings: 0,
        dividers: 0,
        calendars: 0,
        faqs: 0,
        customCode: 0,
        forms: 0
    };

    const countElements = (obj) => {
        if (!obj || typeof obj !== 'object') return;

        if (obj.type === 'section') counts.sections++;
        if (obj.type === 'row') counts.rows++;
        if (obj.type === 'column') counts.columns++;
        if (obj.type === 'element') {
            counts.elements++;
            if (obj.meta === 'button') counts.buttons++;
            if (obj.meta === 'image') counts.images++;
            if (obj.meta === 'paragraph') counts.paragraphs++;
            if (obj.meta === 'heading') counts.headings++;
            if (obj.meta === 'subHeading') counts.subHeadings++;
            if (obj.meta === 'divider') counts.dividers++;
            if (obj.meta === 'calendar') counts.calendars++;
            if (obj.meta === 'faq') counts.faqs++;
            if (obj.meta === 'customCode') counts.customCode++;
            if (obj.meta === 'form') counts.forms++;
        }

        if (Array.isArray(obj)) {
            obj.forEach(item => countElements(item));
        } else {
            Object.values(obj).forEach(value => {
                if (typeof value === 'object') {
                    countElements(value);
                }
            });
        }
    };

    countElements(builderData.sections);
    return counts;
}

/**
 * Enrich funnels with full details using 3-step enrichment process
 */
async function enrichFunnels(funnels, locationId) {
    if (!funnels || funnels.length === 0 || !locationId) {
        return { enrichedFunnels: funnels, allPages: [], allSteps: [], allElementCounts: [] };
    }

    const enrichedFunnels = [];
    const allPages = [];
    const allSteps = [];
    const allElementCounts = [];

    for (let i = 0; i < funnels.length; i++) {
        const funnel = funnels[i];
        const funnelId = funnel._id || funnel.id;
        const funnelName = funnel.name || 'Unnamed Funnel';

        sendProgressUpdate(45, `Funnel ${i + 1}/${funnels.length}: "${funnelName}" - Fetching pages...`);

        try {
            // Step 1: Fetch page list with version history
            const pageList = await fetchFunnelPageList(funnelId, locationId);
            sendProgressUpdate(46, `Funnel ${i + 1}/${funnels.length}: "${funnelName}" - Found ${pageList.length} pages`);

            // Step 2: Process each page
            let totalVersions = 0;
            let livePages = 0;
            let draftPages = 0;
            let deletedPages = 0;
            const stepIds = new Set();

            for (let pageIndex = 0; pageIndex < pageList.length; pageIndex++) {
                const page = pageList[pageIndex];
                const pageId = page._id;
                const pageName = page.name || 'Unnamed Page';

                // Collect step IDs
                if (page.stepId) {
                    stepIds.add(page.stepId);
                }

                // Count versions
                if (page.versionHistory) {
                    totalVersions += page.versionHistory.length;
                    const liveVersion = page.versionHistory.find(v => v.pageType === 'live');
                    if (liveVersion) livePages++;
                    const draftVersion = page.versionHistory.find(v => v.pageType === 'draft');
                    if (draftVersion) draftPages++;
                }

                if (page.deleted) {
                    deletedPages++;
                }

                // Fetch page builder data for element counts
                sendProgressUpdate(47, `Funnel ${i + 1}/${funnels.length} > Page ${pageIndex + 1}/${pageList.length}: "${pageName}"`);
                const builderData = await fetchFunnelPageBuilderData(pageId);
                const elementCounts = countPageElements(builderData);

                // Add to pages collection
                allPages.push({
                    funnelId: funnelId,
                    funnelName: funnelName,
                    pageId: pageId,
                    pageName: pageName,
                    pageUrl: page.url || '',
                    stepId: page.stepId || '',
                    deleted: page.deleted || false,
                    dateAdded: page.dateAdded || '',
                    dateUpdated: page.dateUpdated || '',
                    versionCount: page.versionHistory ? page.versionHistory.length : 0,
                    templateType: page.templateType || '',
                    seoTitle: page.meta?.title || '',
                    seoDescription: page.meta?.description || '',
                    seoAuthor: page.meta?.author || '',
                    seoKeywords: page.meta?.keywords || '',
                    seoLanguage: page.meta?.language || '',
                    seoImageUrl: page.meta?.imageUrl || '',
                    previewSnapshot: page.previewSnapshot || '',
                    ...elementCounts
                });

                // Add element counts
                if (Object.keys(elementCounts).length > 0) {
                    allElementCounts.push({
                        funnelId: funnelId,
                        funnelName: funnelName,
                        pageId: pageId,
                        pageName: pageName,
                        ...elementCounts
                    });
                }
            }

            // Step 3: Fetch step details for all unique step IDs
            sendProgressUpdate(48, `Funnel ${i + 1}/${funnels.length}: Fetching ${stepIds.size} step details...`);
            let stepCount = 0;
            for (const stepId of stepIds) {
                stepCount++;
                sendProgressUpdate(48, `Funnel ${i + 1}/${funnels.length}: Step ${stepCount}/${stepIds.size}`);
                const stepDetails = await fetchFunnelStepDetails(funnelId, locationId, stepId);
                for (const step of stepDetails) {
                    allSteps.push({
                        funnelId: funnelId,
                        funnelName: funnelName,
                        stepId: step.typeId || stepId,
                        stepInternalId: step._id || '',
                        domain: step.domain || '',
                        path: step.path || '',
                        pathLowercase: step.pathLowercase || '',
                        type: step.type || '',
                        deleted: step.deleted || false,
                        dateAdded: step.dateAdded || '',
                        dateUpdated: step.dateUpdated || ''
                    });
                }
            }

            // Create enriched funnel object
            const enrichedFunnel = {
                ...funnel,
                pageCount: pageList.length,
                livePageCount: livePages,
                draftPageCount: draftPages,
                deletedPageCount: deletedPages,
                totalVersions: totalVersions,
                stepCount: stepIds.size,
                pages: pageList.map(p => p.name || p.title).filter(Boolean).join('; ')
            };

            enrichedFunnels.push(enrichedFunnel);
            sendProgressUpdate(49, `Funnel ${i + 1}/${funnels.length}: "${funnelName}" - Complete (${pageList.length} pages, ${stepIds.size} steps)`);
        } catch (error) {
            sendProgressUpdate(49, `Funnel ${i + 1}/${funnels.length}: "${funnelName}" - Error occurred, using basic data`);
            enrichedFunnels.push(funnel);
        }
    }

    sendProgressUpdate(50, `All ${funnels.length} funnels processed successfully`);
    return { enrichedFunnels, allPages, allSteps, allElementCounts };
}

/**
 * Enrich calendars with full details
 */
async function enrichCalendars(calendars, locationId) {
    if (!calendars || calendars.length === 0 || !locationId) {
        return calendars;
    }

    try {
        // Use the new endpoint to get all calendars at once with full details
        const endpoint = `/calendars/?locationId=${locationId}&showThirdParty=false`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);

        if (!response || !response.data || !response.data.calendars) {
            return calendars;
        }

        const calendarsFromAPI = response.data.calendars;
        const enrichedCalendars = [];

        // Match the snapshot calendars with the enriched data
        for (let i = 0; i < calendars.length; i++) {
            const calendar = calendars[i];
            const calendarId = calendar._id || calendar.id;
            const calendarName = calendar.name || 'Unnamed Calendar';

            // Find matching calendar from API response
            const apiCalendar = calendarsFromAPI.find(c => c.id === calendarId);

            if (apiCalendar) {
                const teamMembers = apiCalendar.teamMembers || [];
                const teamMemberCount = teamMembers.length;
                const teamMemberNames = teamMembers.map(tm => tm.userId).join('; ');

                const enrichedCalendar = {
                    ...calendar,
                    calendarType: apiCalendar.calendarType || '',
                    eventType: apiCalendar.eventType || '',
                    slug: apiCalendar.slug || '',
                    widgetSlug: apiCalendar.widgetSlug || '',
                    description: apiCalendar.description || '',
                    dateAdded: apiCalendar.dateAdded || '',
                    dateUpdated: apiCalendar.dateUpdated || '',
                    deleted: apiCalendar.deleted || false,
                    groupId: apiCalendar.groupId || '',
                    isActive: apiCalendar.isActive !== false,
                    version: apiCalendar.version || '',
                    calendarCoverImage: apiCalendar.calendarCoverImage || '',

                    // Slot configuration
                    slotDuration: apiCalendar.slotDuration || '',
                    slotDurationUnit: apiCalendar.slotDurationUnit || '',
                    slotInterval: apiCalendar.slotInterval || '',
                    slotIntervalUnit: apiCalendar.slotIntervalUnit || '',
                    slotBufferUnit: apiCalendar.slotBufferUnit || '',
                    preBufferUnit: apiCalendar.preBufferUnit || '',

                    // Appointment limits
                    appointmentPerSlot: apiCalendar.appoinmentPerSlot || '', // Note: API has typo 'appoinment'
                    appointmentPerDay: apiCalendar.appoinmentPerDay || '',

                    // Features
                    enableOfficeHours: apiCalendar.enableOfficeHours || false,
                    enableRecurring: apiCalendar.enableRecurring || false,
                    enableConsentCheck: apiCalendar.enableConsentCheck || false,
                    enableGuests: apiCalendar.enableGuests || false,
                    enableChargeGuests: apiCalendar.enableChargeGuests || false,
                    enableStaffSelection: apiCalendar.enableStaffSelection || false,
                    enableSameUserAssignment: apiCalendar.enableSameUserAssignment || false,
                    enableSameUserAssignmentForReschedule: apiCalendar.enableSameUserAssignmentForReschedule || false,

                    // Booking rules
                    allowBookingAfter: apiCalendar.allowBookingAfter || '',
                    allowBookingAfterUnit: apiCalendar.allowBookingAfterUnit || '',
                    allowBookingForUnit: apiCalendar.allowBookingForUnit || '',
                    allowCancellation: apiCalendar.allowCancellation || false,
                    allowReschedule: apiCalendar.allowReschedule || false,

                    // Auto settings
                    autoConfirm: apiCalendar.autoConfirm || false,
                    stickyContact: apiCalendar.stickyContact || false,
                    shouldAssignContactToTeamMember: apiCalendar.shouldAssignContactToTeamMember || false,
                    shouldSkipAssigningContactForExisting: apiCalendar.shouldSkipAssigningContactForExisting || false,

                    // Event details
                    eventTitle: apiCalendar.eventTitle || '',
                    eventColor: apiCalendar.eventColor || '',
                    notes: apiCalendar.notes || '',
                    consentLabel: apiCalendar.consentLabel || '',

                    // Form integration
                    formId: apiCalendar.formId || '',
                    formSubmitType: apiCalendar.formSubmitType || '',
                    formSubmitThanksMessage: apiCalendar.formSubmitThanksMessage || '',
                    formSubmitRedirectUrl: apiCalendar.formSubmitRedirectUrl || '',

                    // Team members
                    teamMemberCount: teamMemberCount,
                    teamMembers: teamMemberNames,

                    // Widget configuration
                    widgetType: apiCalendar.widgetType || '',
                    primaryColor: apiCalendar.widgetConfig?.primarySettings?.primaryColor || '',
                    backgroundColor: apiCalendar.widgetConfig?.primarySettings?.backgroundColor || '',
                    buttonText: apiCalendar.widgetConfig?.primarySettings?.buttonText || '',

                    // Tracking
                    pixelId: apiCalendar.pixelId || '',
                    fbPixelId: apiCalendar.fbPixelId || '',

                    // Payment
                    isLivePaymentMode: apiCalendar.isLivePaymentMode || false,

                    // Audit trail
                    createdBy: apiCalendar.createdBy?.userId || '',
                    createdByChannel: apiCalendar.createdBy?.channel || '',
                    createdBySource: apiCalendar.createdBy?.source || '',
                    lastUpdatedBy: apiCalendar.lastUpdatedBy?.userId || '',
                    lastUpdatedByChannel: apiCalendar.lastUpdatedBy?.channel || '',

                    // Full API data (conditional)
                    fullEnrichmentData: _includeFullEnrichmentData ? apiCalendar : undefined
                };

                enrichedCalendars.push(enrichedCalendar);
            } else {
                enrichedCalendars.push(calendar);
            }
        }

        return enrichedCalendars;
    } catch (error) {
        return calendars;
    }
}

/**
 * Extract calendar configuration for the location
 */
async function extractCalendarConfiguration(locationId) {
    if (!locationId) {
        return null;
    }

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
            configId: configData._id || '',
            // Full API data (conditional)
            fullEnrichmentData: _includeFullEnrichmentData ? configData : undefined
        };

        return config;
    } catch (error) {
        return null;
    }
}

/**
 * Fetch and enrich calendar groups
 */
async function enrichCalendarGroups(locationId) {
    if (!locationId) {
        return [];
    }

    try {
        const endpoint = `/calendars/groups?locationId=${locationId}`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);

        if (!response || !response.data || !response.data.groups) {
            return [];
        }

        const groups = response.data.groups;
        const enrichedGroups = groups.map(group => ({
            id: group.id || '',
            locationId: group.locationId || locationId,
            name: group.name || '',
            description: group.description || '',
            slug: group.slug || '',
            isActive: group.isActive !== false,
            dateAdded: group.dateAdded || '',
            dateUpdated: group.dateUpdated || '',
            // Full API data (conditional)
            fullEnrichmentData: _includeFullEnrichmentData ? group : undefined
        }));

        return enrichedGroups;
    } catch (error) {
        return [];
    }
}

/**
 * Enrich pipelines with stages and details
 */
async function enrichPipelines(pipelines, locationId) {
    if (!pipelines || pipelines.length === 0 || !locationId) {
        return pipelines;
    }

    try {
        // Use the new endpoint to get all pipelines at once with full details
        const endpoint = `/opportunities/pipelines?locationId=${locationId}`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);

        if (!response || !response.data || !response.data.pipelines) {
            return pipelines;
        }

        const pipelinesFromAPI = response.data.pipelines;
        const enrichedPipelines = [];

        // Match the snapshot pipelines with the enriched data
        for (let i = 0; i < pipelines.length; i++) {
            const pipeline = pipelines[i];
            const pipelineId = pipeline._id || pipeline.id;
            const pipelineName = pipeline.name || 'Unnamed Pipeline';

            // Find matching pipeline from API response
            const apiPipeline = pipelinesFromAPI.find(p => p.id === pipelineId);

            if (apiPipeline) {
                const stages = apiPipeline.stages || [];
                const stageNames = stages.map(s => s.name).join('; ');

                const enrichedPipeline = {
                    ...pipeline,
                    originId: apiPipeline.originId || '',
                    dateAdded: apiPipeline.dateAdded || '',
                    dateUpdated: apiPipeline.dateUpdated || '',
                    showInFunnel: apiPipeline.showInFunnel !== false,
                    showInPieChart: apiPipeline.showInPieChart !== false,
                    stageCount: stages.length,
                    stages: stageNames,
                    stagesDetailed: stages.map(s => ({
                        id: s.id,
                        name: s.name,
                        originId: s.originId || '',
                        position: s.position,
                        showInFunnel: s.showInFunnel !== false,
                        showInPieChart: s.showInPieChart !== false
                    })),
                    firstStage: stages.length > 0 ? stages[0].name : '',
                    lastStage: stages.length > 0 ? stages[stages.length - 1].name : '',
                    fullEnrichmentData: apiPipeline
                };

                enrichedPipelines.push(enrichedPipeline);
            } else {
                enrichedPipelines.push(pipeline);
            }
        }

        return enrichedPipelines;
    } catch (error) {
        return pipelines;
    }
}

/**
 * Extract all pipeline stages into a flat list for detailed stage worksheet
 * Uses already-enriched pipeline data (no additional API calls)
 */
function extractPipelineStages(enrichedPipelines) {
    if (!enrichedPipelines || enrichedPipelines.length === 0) {
        return [];
    }

    const allStages = [];

    for (let i = 0; i < enrichedPipelines.length; i++) {
        const pipeline = enrichedPipelines[i];
        const pipelineId = pipeline._id || pipeline.id;
        const pipelineName = pipeline.name || 'Unnamed Pipeline';

        // Get stages from already-enriched data
        const stages = pipeline.stagesDetailed || [];

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
                dateAdded: pipeline.dateAdded || '',
                dateUpdated: pipeline.dateUpdated || '',
                // Full stage data (conditional)
                fullEnrichmentData: _includeFullEnrichmentData ? stage : undefined
            });
        });

    }

    return allStages;
}

/**
 * Fetch paginated email templates from a specific parent (or root if no parentId)
 */
async function fetchEmailBuilderPage(locationId, parentId = null) {
    const allItems = [];
    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
        let endpoint = `/emails/builder?locationId=${locationId}&limit=${limit}&sortByDate=desc&archived=false&offset=${offset}&name=&templatesOnly=false`;
        if (parentId) {
            endpoint += `&parentId=${parentId}`;
        }
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);

        if (!response || !response.data) {
            break;
        }

        const builders = response.data.builders || [];
        const totalCount = response.data.total?.[0]?.total || 0;

        allItems.push(...builders);
        offset += limit;
        hasMore = builders.length === limit && offset < totalCount;
    }

    return allItems;
}

/**
 * Enrich email templates with details, including templates inside folders
 */
async function enrichEmailTemplates(templates, locationId) {
    if (!locationId) {
        return templates || [];
    }

    try {
        // Fetch all top-level templates
        const topLevel = await fetchEmailBuilderPage(locationId);

        // Separate folders from templates
        const folders = topLevel.filter(t => t.templateType === 'folder');
        const rootTemplates = topLevel.filter(t => t.templateType !== 'folder');

        // Fetch templates inside each folder
        const allTemplates = rootTemplates.map(t => ({ ...t, folder: '' }));
        for (const folder of folders) {
            const folderContents = await fetchEmailBuilderPage(locationId, folder.id);
            for (const item of folderContents) {
                allTemplates.push({ ...item, folder: folder.name || '' });
            }
        }

        // Map fields from Email Builder response structure
        const enrichedTemplates = allTemplates.map(template => ({
            id: template.id || '',
            locationId: locationId,
            name: template.name || '',
            folder: template.folder || '',
            updatedBy: template.updatedBy || '',
            isPlainText: template.isPlainText !== undefined ? template.isPlainText : false,
            lastUpdated: template.lastUpdated || '',
            dateAdded: template.dateAdded || '',
            previewUrl: template.previewUrl || '',
            version: template.version || '',
            templateType: template.templateType || 'builder',
            archived: template.archived !== undefined ? template.archived : false,
            fullEnrichmentData: _includeFullEnrichmentData ? template : undefined
        }));

        return enrichedTemplates;
    } catch (error) {
        return templates || [];
    }
}

/**
 * Fetch and enrich email builder templates, including templates inside folders
 */
async function enrichEmailBuilderTemplates(locationId) {
    if (!locationId) {
        return [];
    }

    try {
        // Fetch all top-level templates
        const topLevel = await fetchEmailBuilderPage(locationId);

        // Separate folders from templates
        const folders = topLevel.filter(t => t.templateType === 'folder');
        const rootTemplates = topLevel.filter(t => t.templateType !== 'folder');

        // Fetch templates inside each folder
        const allTemplates = rootTemplates.map(t => ({ ...t, folder: '' }));
        for (const folder of folders) {
            const folderContents = await fetchEmailBuilderPage(locationId, folder.id);
            for (const item of folderContents) {
                allTemplates.push({ ...item, folder: folder.name || '' });
            }
        }

        const enrichedTemplates = allTemplates.map(template => ({
            id: template.id || '',
            locationId: locationId,
            name: template.name || '',
            folder: template.folder || '',
            updatedBy: template.updatedBy || '',
            isPlainText: template.isPlainText || false,
            lastUpdated: template.lastUpdated || '',
            dateAdded: template.dateAdded || '',
            previewUrl: template.previewUrl || '',
            version: template.version || '',
            templateType: template.templateType || '',
            fullEnrichmentData: template
        }));

        return enrichedTemplates;
    } catch (error) {
        return [];
    }
}

/**
 * Fetch specific email builder template data with full enrichment
 */
async function enrichEmailBuilderTemplateDetails(locationId, templateId, isInternal = false) {
    if (!locationId || !templateId) {
        return null;
    }

    try {
        const endpoint = `/emails/builder/data/${locationId}/${templateId}?isInternal=${isInternal}`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);

        if (!response || !response.data) {
            return null;
        }

        const data = response.data;

        // Map rich fields from the response
        const enrichedDetails = {
            id: templateId,
            locationId: locationId,
            name: data.name || '',
            subjectLine: data.subjectLine || '',
            previewUrl: data.previewUrl || '',
            updatedAt: data.updatedAt || '',
            isPlainText: data.isPlainText || false,
            errorsPresent: data.errorsPresent || false,
            type: data.type || 'builder',

            // Editor data structure
            editorData: data.editorData || {},
            editorElementsCount: data.editorData?.elements?.length || 0,
            editorAttributesCount: Object.keys(data.editorData?.attrs || {}).length,

            // Template settings
            templateSettings: data.editorData?.templateSettings || {},
            bodyWidth: data.editorData?.templateSettings?.body?.[0]?.default || 600,
            backgroundColor: data.editorData?.templateSettings?.body?.[1]?.default || '',

            // Error information
            errorItems: data.errorItems || [],
            errorCount: data.errorItems?.length || 0,

            // Full data for advanced use
            fullEnrichmentData: data
        };

        return enrichedDetails;
    } catch (error) {
        return null;
    }
}

/**
 * Enrich surveys with full details
 */
async function enrichSurveys(surveys) {
    if (!surveys || surveys.length === 0) {
        return surveys;
    }

    const enrichedSurveys = [];

    for (let i = 0; i < surveys.length; i++) {
        const survey = surveys[i];
        const surveyId = survey._id || survey.id;
        const surveyName = survey.name || 'Unnamed Survey';

        try {
            // Use the new services endpoint for detailed survey data
            const endpoint = `/surveys/${surveyId}`;
            await window.ghlUtilsRevex.waitForReady();
            const response = await window.ghlUtilsRevex.get(endpoint, 'services');

            if (!response || !response.data || !response.data.survey) {
                enrichedSurveys.push(survey);
                continue;
            }

            const fullSurveyData = response.data.survey;
            const formData = fullSurveyData.formData || {};
            const formConfig = formData.form || {};
            const slides = formData.slides || [];

            // Count total fields across all slides
            const totalFields = slides.reduce((total, slide) => {
                return total + (slide.slideData ? slide.slideData.length : 0);
            }, 0);

            // Extract field types from slides
            const fieldTypes = slides.flatMap(slide =>
                (slide.slideData || []).map(field => field.type)
            ).join('; ');

            const enrichedSurvey = {
                ...survey,
                deleted: fullSurveyData.deleted || false,
                dateAdded: fullSurveyData.dateAdded || '',
                dateUpdated: fullSurveyData.dateUpdated || '',

                // Survey configuration
                autoResponder: formData.autoResponder || false,
                emailNotifications: formData.emailNotifications || false,
                enablePartialContactCreation: formData.enablePartialContactCreation || false,

                // Branding
                companyName: formConfig.company?.name || '',

                // Survey settings
                disableAutoNavigation: formConfig.disableAutoNavigation || false,
                enableTimezone: formConfig.enableTimezone || false,
                isAnimationDisabled: formConfig.isAnimationDisabled || false,
                isBackButtonEnable: formConfig.isBackButtonEnable || false,
                isGDPRCompliant: formConfig.isGDPRCompliant || false,
                isProgressBarEnabled: formConfig.isProgressBarEnabled || false,
                isSurveyScrollEnabled: formConfig.isSurveyScrollEnabled || false,
                stickyContact: formConfig.stickyContact || false,

                // Slides and fields
                totalSlides: slides.length,
                totalFields: totalFields,
                fieldTypes: fieldTypes,

                // Form action settings
                formActionType: formConfig.formAction?.actionType || '',
                fieldsPerPage: formConfig.formAction?.fieldPerPage || '',
                endSurveyType: formConfig.formAction?.endsurveyType || '',
                endSurveyText: formConfig.formAction?.endsurveyText || '',
                disqualifiedType: formConfig.formAction?.disqualifiedType || '',
                disqualifiedText: formConfig.formAction?.disqualifiedText || '',
                thankyouText: formConfig.formAction?.thankyouText || '',
                redirectUrl: formConfig.formAction?.redirectUrl || '',

                // Styling
                currentThemeId: formConfig.currentThemeId || '',
                backgroundColor: formConfig.style?.background || '',
                bgImage: formConfig.style?.bgImage || '',

                // Tracking
                fbPixelId: formConfig.fbPixelId || '',

                // Footer configuration
                footerTheme: formConfig.footerStyle?.theme || '',
                stickyFooter: formConfig.footerStyle?.stickyFooter || false,
                enableProgressBar: formConfig.footerStyle?.enableProgressBar || false,

                // Folder organization
                parentFolderId: formData.parentFolderId || '',
                parentFolderName: formData.parentFolderName || '',

                fullEnrichmentData: fullSurveyData
            };

            enrichedSurveys.push(enrichedSurvey);
        } catch (error) {
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
        return campaigns;
    }

    const enrichedCampaigns = [];

    try {
        // Fetch all campaigns from the API to get full details
        const endpoint = `/emails/campaigns/?locationId=${locationId}&offset=0&limit=1000&search=`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);
        const apiCampaigns = response.data?.campaigns || response.data || [];

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
            } else {
                enrichedCampaigns.push(campaign);
            }
        }
    } catch (error) {
        // Return original campaigns if enrichment fails
        return campaigns;
    }

    return enrichedCampaigns;
}

/**
 * Enrich links with click statistics and trigger details
 */
/**
 * Add reverse-lookup columns to enriched trigger links by scanning each
 * other enriched asset collection for references to this link's ID.
 *
 * `assetsByType` is either the jsonExportData object (location export, values
 * are enriched arrays or nested objects keyed by type) or the raw snapshotData
 * object (snapshot export). Both shapes are handled.
 *
 * Matching strategy: trigger links are referenced by their 24-char ID in
 * workflow action configs, merge tags ({{trigger_links.<id>}}), email HTML,
 * form redirects, etc. We JSON.stringify each candidate asset once and do a
 * substring match on the link ID — IDs are effectively collision-free.
 */
function addTriggerLinkReverseLookup(links, assetsByType) {
    if (!links || !links.length) return links || [];

    const searchTargets = [
        { typeKeys: ['email_templates', 'email_builder'], column: 'usedInEmailTemplates' },
        { typeKeys: ['forms'],                             column: 'usedInForms' },
        { typeKeys: ['surveys'],                           column: 'usedInSurveys' },
        { typeKeys: ['workflow', 'workflows'],             column: 'usedInWorkflows' },
        { typeKeys: ['funnels'],                           column: 'usedInFunnels' },
        { typeKeys: ['text_templates', 'snippets'],        column: 'usedInTextTemplates' },
        { typeKeys: ['campaigns'],                         column: 'usedInCampaigns' }
    ];

    // Resolve each asset list from the haystack — handles both arrays and
    // the nested { funnels, pages, steps } shape used by location export.
    const resolveList = (typeKeys) => {
        for (const key of typeKeys) {
            const raw = assetsByType?.[key];
            if (!raw) continue;
            if (Array.isArray(raw)) return raw;
            if (raw && typeof raw === 'object') {
                // e.g. jsonExportData.funnels = { funnels: [...], pages: [...] }
                const inner = raw[key] || raw.funnels || raw.items || raw.list;
                if (Array.isArray(inner)) return inner;
            }
        }
        return null;
    };

    // Pre-serialize each asset so we only stringify N+M times, not N*M.
    const serializedByColumn = {};
    for (const { typeKeys, column } of searchTargets) {
        const list = resolveList(typeKeys);
        if (!list || !list.length) {
            serializedByColumn[column] = [];
            continue;
        }
        serializedByColumn[column] = list.map(item => {
            let serialized = '';
            try { serialized = JSON.stringify(item); } catch (_) { serialized = ''; }
            return {
                name: item?.name || item?.title || item?.Name || item?.subject || '(unnamed)',
                serialized
            };
        });
    }

    return links.map(link => {
        const linkId = link?._id || link?.id || '';
        if (!linkId) {
            return {
                ...link,
                usedInEmailTemplates: '',
                usedInForms: '',
                usedInSurveys: '',
                usedInWorkflows: '',
                usedInFunnels: '',
                usedInTextTemplates: '',
                usedInCampaigns: '',
                totalReferences: 0
            };
        }

        const result = { ...link };
        let totalReferences = 0;

        for (const { column } of searchTargets) {
            const candidates = serializedByColumn[column] || [];
            const matches = [];
            for (const { name, serialized } of candidates) {
                if (serialized && serialized.includes(linkId)) {
                    matches.push(name);
                }
            }
            result[column] = matches.join('; ');
            totalReferences += matches.length;
        }
        result.totalReferences = totalReferences;
        return result;
    });
}

async function enrichLinks(links, locationId) {
    if (!links || links.length === 0 || !locationId) {
        return links;
    }

    const enrichedLinks = [];

    try {
        // Fetch all links from the API using search endpoint
        const endpoint = `/links/search?locationId=${locationId}&skip=0&limit=1000`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);
        const apiLinks = response.data?.links || response.data || [];

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
            } else {
                enrichedLinks.push(link);
            }
        }
    } catch (error) {
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
        return templates;
    }

    const enrichedTemplates = [];

    try {
        // Fetch all snippets from the API
        const endpoint = `/snippets/${locationId}?skip=0&limit=1000`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);
        const apiTemplates = response.data?.snippets || response.data || [];

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
            } else {
                enrichedTemplates.push(template);
            }
        }
    } catch (error) {
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
        return offers;
    }

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
            } else {
                enrichedOffers.push(offer);
            }
        }
    } catch (error) {
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
        return customFields;
    }

    const enrichedFields = [];

    try {
        // Fetch all custom fields with full details using search endpoint
        const endpoint = `/locations/${locationId}/customFields/search?parentId=&skip=0&limit=1000&documentType=&model=all&query=&includeStandards=false`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);
        const apiFields = response.data?.customFields || response.data || [];

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
            } else {
                enrichedFields.push(field);
            }
        }
    } catch (error) {
        // Return original fields if enrichment fails
        return customFields;
    }

    return enrichedFields;
}

/**
 * Fetch ALL custom fields for a location including contacts, opportunities, and custom objects
 * Used by location exporter to get complete custom field data
 */
async function fetchAllCustomFieldsForLocation(locationId) {
    if (!locationId) {
        return [];
    }

    const allFields = [];
    const seenFieldIds = new Set();

    try {
        await window.ghlUtilsRevex.waitForReady();

        // Fetch custom fields for each model type separately since model=all may not work
        const modelTypes = ['contact', 'opportunity'];

        // First, try to get custom objects to add their names to the model types
        try {
            const objectsResponse = await window.ghlUtilsRevex.get(`/objects/?locationId=${locationId}`);
            const customObjects = objectsResponse?.data?.objects || objectsResponse?.data || [];
            // Add custom object names/keys as model types (API expects name, not ID)
            customObjects.forEach(obj => {
                const objName = obj.key || obj.name;
                if (objName) {
                    modelTypes.push(objName);
                }
            });
        } catch (error) {
        }

        // Fetch custom fields for each model type
        for (const modelType of modelTypes) {
            try {
                const endpoint = `/locations/${locationId}/customFields/search?parentId=&skip=0&limit=1000&documentType=&model=${modelType}&query=&includeStandards=false`;
                const response = await window.ghlUtilsRevex.get(endpoint);

                // Extract fields from response
                let apiFields = [];
                if (response?.data?.customFields && Array.isArray(response.data.customFields)) {
                    apiFields = response.data.customFields;
                } else if (response?.data?.data?.customFields && Array.isArray(response.data.data.customFields)) {
                    apiFields = response.data.data.customFields;
                } else if (response?.customFields && Array.isArray(response.customFields)) {
                    apiFields = response.customFields;
                } else if (Array.isArray(response?.data?.data)) {
                    apiFields = response.data.data;
                } else if (Array.isArray(response?.data)) {
                    apiFields = response.data;
                }

                // Add model type to each field if not present, deduplicate by field ID
                apiFields.forEach(field => {
                    const fieldId = field._id || field.id;
                    if (fieldId && seenFieldIds.has(fieldId)) {
                        return; // Skip duplicate
                    }
                    if (fieldId) {
                        seenFieldIds.add(fieldId);
                    }
                    if (!field.model) {
                        field.model = modelType;
                    }
                    allFields.push(field);
                });
            } catch (error) {
            }
        }

        // Count fields by model type
        const modelCounts = {};
        const enrichedFields = [];

        // Process ALL custom fields from the API
        for (let i = 0; i < allFields.length; i++) {
            const apiData = allFields[i];
            const fieldId = apiData._id || apiData.id;
            const fieldName = apiData.name || 'Unnamed Field';
            const model = apiData.model || 'contact';

            // Track counts by model
            modelCounts[model] = (modelCounts[model] || 0) + 1;

            const enrichedField = {
                id: fieldId,
                _id: fieldId,
                name: fieldName,
                // Field type and configuration
                dataType: apiData.dataType || apiData.type || '',
                fieldType: apiData.fieldType || '',
                // Model associations - indicates which object type this field belongs to
                model: model,
                modelDisplayName: formatCustomFieldModelName(model),
                applicableModels: apiData.applicableModels || [model],
                // Organization
                folderName: apiData.folderName || apiData.parentName || 'Root',
                parentId: apiData.parentId || '',
                position: apiData.position || 0,
                // Field properties
                isRequired: apiData.isRequired || false,
                isUnique: apiData.isUnique || false,
                isSearchable: apiData.isSearchable || false,
                placeholder: apiData.placeholder || '',
                // Options for select/dropdown fields
                hasOptions: !!(apiData.options && apiData.options.length > 0),
                optionCount: apiData.options ? apiData.options.length : 0,
                options: apiData.options ? apiData.options.map(opt => opt.name || opt.label || opt).join('; ') : '',
                // Metadata
                createdBy: apiData.createdBy || '',
                updatedAt: apiData.updatedAt || '',
                // Full API data
                fullEnrichmentData: _includeFullEnrichmentData ? apiData : undefined
            };

            enrichedFields.push(enrichedField);
        }

        // Log summary by model type
        return enrichedFields;

    } catch (error) {
        return [];
    }
}

/**
 * Format model name for display in custom fields
 */
function formatCustomFieldModelName(model) {
    const modelNames = {
        'contact': 'Contact',
        'opportunity': 'Opportunity',
        'company': 'Company',
        'order': 'Order',
        'subscription': 'Subscription',
        'task': 'Task',
        'invoice': 'Invoice',
        'payment': 'Payment'
    };

    // Check if it's a custom object ID (starts with specific pattern or is a long alphanumeric string)
    if (model && model.length > 20 && /^[a-zA-Z0-9]+$/.test(model)) {
        return 'Custom Object';
    }

    return modelNames[model] || model || 'Contact';
}

/**
 * Enrich custom values with usage and organization details
 */
async function enrichCustomValues(customValues, locationId) {
    if (!customValues || customValues.length === 0 || !locationId) {
        return customValues;
    }

    const enrichedValues = [];

    try {
        // Fetch all custom values from the API
        const endpoint = `/locations/${locationId}/customValues/`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);
        const apiValues = response.data?.customValues || response.data || [];

        // Fetch custom value folders
        const folderMap = new Map();
        try {
            const folderEndpoint = `/locations/${locationId}/customValues/search?skip=0&limit=100&getCount=true&documentType=folder`;
            await window.ghlUtilsRevex.waitForReady();
            const folderResponse = await window.ghlUtilsRevex.get(folderEndpoint, 'services');
            const folders = folderResponse.data?.customValueFolders || [];
            folders.forEach(f => {
                const folderId = f._id || f.id;
                if (folderId) {
                    folderMap.set(folderId, f.name || '');
                }
            });
        } catch (folderError) {
            // Continue without folder data if fetch fails
        }

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

            const apiData = valueMap.get(valueId);

            if (apiData) {
                const parentId = apiData.parentId || value.parentId || null;
                const enrichedValue = {
                    ...value,
                    // Value details
                    value: apiData.value || value.value || '',
                    type: apiData.type || value.type || 'text',
                    // Organization
                    folder: parentId ? (folderMap.get(parentId) || '') : '',
                    category: apiData.category || value.category || '',
                    description: apiData.description || value.description || '',
                    // Metadata
                    isActive: apiData.isActive !== undefined ? apiData.isActive : true,
                    createdBy: apiData.createdBy || value.createdBy || '',
                    updatedAt: apiData.updatedAt || value.updatedAt || '',
                    // Full API data (conditional)
                    fullEnrichmentData: _includeFullEnrichmentData ? apiData : undefined
                };

                enrichedValues.push(enrichedValue);
            } else {
                const parentId = value.parentId || null;
                enrichedValues.push({
                    ...value,
                    folder: parentId ? (folderMap.get(parentId) || '') : ''
                });
            }
        }
    } catch (error) {
        // Return original values if enrichment fails
        return customValues;
    }

    return enrichedValues;
}

/**
 * Resolve `contactCount` for a list of tag names by hitting the v2 contact
 * search endpoint once per tag and reading `total`.
 *
 *   POST services.leadconnectorhq.com/contacts/search/2
 *   filters: [{ group: 'OR', filters: [{ group: 'AND', filters: [
 *     { field: 'tags', operator: 'eq', value: ['<tag>'], options: { minimumMatch: 'all' } }
 *   ]}]}]
 *
 * Why this beats paginating every contact: pagination cursors on the
 * services search endpoint were truncating silently, so most tags ended up
 * at 0. With per-tag filters we just trust the server's `total` field per
 * call; no cursor, no aggregation, no drift.
 *
 * Returns Map<lowercasedTagName, count>.
 */
async function fetchContactsAndCountTags(locationId, tagNames, progressCallback = null) {
    const counts = new Map();
    if (!locationId || !Array.isArray(tagNames) || tagNames.length === 0) return counts;

    // De-dupe by lowercased name; preserve original casing for the API call
    // since GHL's tag filter is case-sensitive on the value.
    const uniq = [];
    const seen = new Set();
    for (const raw of tagNames) {
        const name = String(raw == null ? '' : raw).trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        uniq.push({ name, key });
    }

    const isTransient = (err) => {
        const msg = (err && (err.message || String(err))) || '';
        return /429|rate.?limit|timeout|timed out|network|fetch failed|5\d\d/i.test(msg);
    };

    const concurrency = 4;
    const MAX_RETRIES = 4;
    let processed = 0;

    try {
        await window.ghlUtilsRevex.waitForReady();
    } catch (_) {}

    for (let i = 0; i < uniq.length; i += concurrency) {
        const batch = uniq.slice(i, i + concurrency);
        await Promise.all(batch.map(async ({ name, key }) => {
            const body = {
                filters: [{
                    group: 'OR',
                    filters: [{
                        group: 'AND',
                        filters: [{
                            field: 'tags',
                            operator: 'eq',
                            value: [name],
                            options: { minimumMatch: 'all' }
                        }]
                    }]
                }],
                locationId,
                page: 1,
                // We only need `total`; keep payload tiny.
                pageLimit: 1,
                sort: []
            };

            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                try {
                    const response = await window.ghlUtilsRevex.post('/contacts/search/2', body, 'services');
                    const data = response?.data || {};
                    const cnt = typeof data.total === 'number'
                        ? data.total
                        : (typeof data.totalCount === 'number' ? data.totalCount : 0);
                    counts.set(key, cnt);
                    return;
                } catch (err) {
                    if (!isTransient(err) || attempt === MAX_RETRIES - 1) {
                        console.warn(`[Tag Count] "${name}" failed:`, err?.message || err);
                        counts.set(key, 0);
                        return;
                    }
                    const delayMs = 500 + attempt * 700 + (/(429|rate)/i.test(err?.message || '') ? 1200 : 0);
                    await new Promise(r => setTimeout(r, delayMs));
                }
            }
        }));

        processed += batch.length;
        if (progressCallback) {
            try { progressCallback(processed, uniq.length); } catch (_) {}
        }
    }

    console.info(`[Tag Count] Resolved ${counts.size}/${uniq.length} tag counts via /contacts/search/2.`);
    return counts;
}

/**
 * Fetch every email snippet for a location, paginating until totalCount is met.
 * Returns Map<snippetId, snippet> so workflow email actions referencing a
 * `template_id` can be resolved back to their stored html/subject.
 */
async function fetchEmailSnippets(locationId, progressCallback = null) {
    const snippetMap = new Map();
    if (!locationId) return snippetMap;

    const isTransient = (err) => {
        const msg = (err && (err.message || String(err))) || '';
        return /429|rate.?limit|timeout|timed out|network|fetch failed|5\d\d/i.test(msg);
    };

    try {
        await window.ghlUtilsRevex.waitForReady();

        const limit = 100;
        let skip = 0;
        let total = null;
        let pageCount = 0;
        const MAX_PAGES = 500;
        const MAX_RETRIES = 4;

        while (pageCount < MAX_PAGES) {
            pageCount++;
            const endpoint = `/snippets/${locationId}?type=email&skip=${skip}&limit=${limit}`;

            let response = null;
            let lastErr = null;
            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                try {
                    response = await window.ghlUtilsRevex.get(endpoint);
                    break;
                } catch (err) {
                    lastErr = err;
                    if (!isTransient(err) || attempt === MAX_RETRIES - 1) break;
                    const delayMs = 600 + attempt * 800 + (/(429|rate)/i.test(err?.message || '') ? 1500 : 0);
                    await new Promise(r => setTimeout(r, delayMs));
                }
            }
            if (!response) {
                console.warn('[Email Snippets] Aborting pagination — last error:', lastErr?.message || lastErr);
                break;
            }

            const data = response.data || {};
            const snippets = data.snippets || data.data || [];
            if (total == null) total = data.totalCount ?? data.total ?? null;

            if (!snippets.length) break;

            for (const sn of snippets) {
                const id = sn._id || sn.id;
                if (id) snippetMap.set(id, sn);
            }

            if (progressCallback) {
                try { progressCallback(snippetMap.size, total); } catch (_) {}
            }

            skip += snippets.length;
            if (typeof total === 'number' && snippetMap.size >= total) break;
            if (snippets.length < limit) break;
        }

        console.info('[Email Snippets] Fetched ' + snippetMap.size + ' email snippets across ' + pageCount + ' pages.');
    } catch (error) {
        console.warn('[Email Snippets] Unexpected error fetching snippets:', error);
    }

    return snippetMap;
}

/**
 * Fetch the trigger list for a single workflow email step. The endpoint is
 * keyed on `${workflowId}:${emailStepId}` and returns 0..N triggers per step.
 */
async function fetchEmailActionTriggers(locationId, workflowId, emailStepId) {
    if (!locationId || !workflowId || !emailStepId) return [];

    const isTransient = (err) => {
        const msg = (err && (err.message || String(err))) || '';
        return /429|rate.?limit|timeout|timed out|network|fetch failed|5\d\d/i.test(msg);
    };

    const endpoint = `/emails/trigger/campaign/${locationId}/${workflowId}:${emailStepId}?showCount=true`;
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            await window.ghlUtilsRevex.waitForReady();
            const response = await window.ghlUtilsRevex.get(endpoint);
            const data = response?.data || {};
            return Array.isArray(data.triggers) ? data.triggers : [];
        } catch (err) {
            // 404 just means there are no triggers configured for this step.
            const msg = (err && (err.message || String(err))) || '';
            if (/404/.test(msg)) return [];
            if (!isTransient(err) || attempt === MAX_RETRIES - 1) {
                console.warn(`[Email Triggers] ${workflowId}:${emailStepId} failed:`, msg);
                return [];
            }
            await new Promise(r => setTimeout(r, 500 + attempt * 700));
        }
    }
    return [];
}

/**
 * Walk every enriched workflow's templates, pull out send-email actions, and
 *  - merge in the referenced email snippet's html/subject when `template_id` is set,
 *  - fetch any triggers (open/click/etc.) configured against that step,
 *  - mutate each email template in place so the workflow JSON also carries
 *    `_snippetContent` and `_triggers`.
 *
 * Returns a flat Email Actions list suitable for its own sheet/section.
 */
async function collectEmailActionsFromWorkflows(workflows, locationId, snippetMap, progressCallback = null) {
    const emailActions = [];
    if (!Array.isArray(workflows) || !locationId) return emailActions;

    const fmtTrigger = (t) => {
        const tag = t.tag || t.value || '';
        const cond = t.condition || t.event || '';
        const evCount = (typeof t.totalEvents === 'number') ? t.totalEvents : '';
        return [tag, cond, evCount === '' ? '' : `(${evCount} events)`].filter(Boolean).join(' ');
    };

    // Two-stage walk so we can show progress against the total step count.
    const queue = [];
    for (const wf of workflows) {
        const workflowId = wf.id || wf._id;
        if (!workflowId) continue;
        const templates = wf.fullEnrichmentData?.workflowData?.templates
            || wf.workflowData?.templates
            || [];
        for (const tpl of templates) {
            const t = (tpl.type || '').toLowerCase();
            if (t === 'email' || t === 'send_email' || t === 'send-email') {
                queue.push({ workflow: wf, workflowId, template: tpl });
            }
        }
    }

    let processed = 0;
    const total = queue.length;
    const concurrency = 4;

    for (let i = 0; i < queue.length; i += concurrency) {
        const batch = queue.slice(i, i + concurrency);
        const results = await Promise.all(batch.map(async ({ workflow, workflowId, template }) => {
            const stepId = template.id || template._id;
            const attrs = template.attributes || {};
            const snippetId = attrs.template_id || attrs.templateId || '';
            const snippet = snippetId && snippetMap ? snippetMap.get(snippetId) : null;

            const subject = attrs.subject || snippet?.template?.subject || '';
            const html = attrs.html || snippet?.template?.html || '';
            const fromName = attrs.from_name || attrs.fromName || '';
            const fromEmail = attrs.from_email || attrs.fromEmail || '';

            const triggers = await fetchEmailActionTriggers(locationId, workflowId, stepId);

            // Mutate the workflow template so the workflow JSON/HTML also carries this enrichment.
            template._snippetContent = snippet
                ? {
                    snippetId,
                    snippetName: snippet.name || '',
                    subject: snippet.template?.subject || '',
                    html: snippet.template?.html || ''
                }
                : null;
            template._triggers = triggers;
            template._triggerCount = triggers.length;

            const actionName = template.name || 'Unnamed Email';
            return {
                // `id` + `name` so renderCard / convertAssetTypeToArray show
                // a meaningful title instead of "(unnamed)".
                id: stepId || '',
                name: actionName,
                workflowId,
                workflowName: workflow.name || 'Unnamed Workflow',
                workflowStatus: workflow.status || '',
                emailStepId: stepId || '',
                actionName,
                order: typeof template.order === 'number' ? template.order : '',
                subject,
                fromName,
                fromEmail,
                snippetId: snippetId || '',
                snippetName: snippet?.name || '',
                hasInlineHtml: !!attrs.html,
                hasSnippetReference: !!snippet,
                bodyPreview: (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200),
                html,
                triggerCount: triggers.length,
                triggers: triggers.map(fmtTrigger).filter(Boolean).join(' | '),
                triggersFull: triggers,
                attachmentCount: Array.isArray(attrs.attachments) ? attrs.attachments.length : 0
            };
        }));
        emailActions.push(...results);
        processed += batch.length;
        if (progressCallback) {
            try { progressCallback(processed, total); } catch (_) {}
        }
    }

    console.info('[Email Actions] Collated ' + emailActions.length + ' email actions across ' + workflows.length + ' workflows.');
    return emailActions;
}

/**
 * Enrich tags with usage statistics and organization details
 */
async function enrichTags(tags, locationId, tagToWorkflowMap = null, tagContactCountMap = null) {
    if (!tags || tags.length === 0 || !locationId) {
        return tags;
    }

    const enrichedTags = [];

    const lookupContactCount = (name) => {
        if (!tagContactCountMap || !name) return null;
        const v = tagContactCountMap.get(String(name).trim().toLowerCase());
        return typeof v === 'number' ? v : null;
    };

    try {
        // Try to fetch all tags from the API
        // Based on permissions, the endpoint should be /locations/{locationId}/tags
        const endpoint = `/locations/${locationId}/tags`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);
        const apiTags = response.data?.tags || response.data || [];

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

            const apiData = tagMap.get(tagId);

            if (apiData) {
                const resolvedName = apiData.name || tag.name || '';
                const derivedCount = lookupContactCount(resolvedName);
                const contactCount = derivedCount ?? apiData.contactCount ?? apiData.usageCount ?? 0;
                const opportunityCount = apiData.opportunityCount || 0;
                const enrichedTag = {
                    ...tag,
                    // Tag details
                    name: resolvedName,
                    color: apiData.color || tag.color || '',
                    // Usage statistics
                    contactCount,
                    opportunityCount,
                    totalUsage: contactCount + opportunityCount,
                    // Organization
                    category: apiData.category || tag.category || '',
                    description: apiData.description || tag.description || '',
                    // Metadata
                    isActive: apiData.isActive !== undefined ? apiData.isActive : true,
                    createdAt: apiData.createdAt || tag.createdAt || '',
                    createdBy: apiData.createdBy || tag.createdBy || '',
                    lastUsedAt: apiData.lastUsedAt || '',
                    // Full API data (conditional)
                    fullEnrichmentData: _includeFullEnrichmentData ? apiData : undefined,
                    // Workflows using this tag (reverse lookup)
                    workflowsUsingTag: tagToWorkflowMap?.get(resolvedName)?.join('; ') || ''
                };

                enrichedTags.push(enrichedTag);
            } else {
                const derivedCount = lookupContactCount(tag.name);
                enrichedTags.push({
                    ...tag,
                    contactCount: derivedCount ?? tag.contactCount ?? 0,
                    workflowsUsingTag: tagToWorkflowMap?.get(tag.name || '')?.join('; ') || ''
                });
            }
        }
    } catch (error) {
        // Return original tags if enrichment fails (endpoint might not exist)
        return tags;
    }

    return enrichedTags;
}

/**
 * Enrich knowledge bases with files, URLs, FAQs, rich text, and usage details
 */
async function enrichKnowledgeBases(knowledgeBases, locationId) {
    if (!knowledgeBases || knowledgeBases.length === 0 || !locationId) {
        return knowledgeBases;
    }

    const enrichedKBs = [];

    try {
        // Fetch all knowledge bases from API (uses services.leadconnectorhq.com)
        const endpoint = `/knowledge-base/all?locationId=${locationId}`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint, 'services');
        const apiKBs = response.data?.knowledgeBases || response.data?.data?.knowledgeBases || [];

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

            const apiData = kbMap.get(kbId);

            if (apiData && kbId) {
                // Try to fetch detailed information for this knowledge base
                let kbDetails = null;
                let kbFiles = [];
                let kbUrls = [];
                let kbFaqs = [];
                let kbRichText = [];
                let kbOperations = null;

                try {
                    // Fetch KB details (uses services.leadconnectorhq.com)
                    const detailsResponse = await window.ghlUtilsRevex.get(`/knowledge-base/${kbId}`, 'services');
                    kbDetails = detailsResponse.data?.data || detailsResponse.data || null;
                } catch (error) {
                }

                try {
                    // Fetch KB files (uses services.leadconnectorhq.com)
                    const filesResponse = await window.ghlUtilsRevex.get(`/knowledge-base/files/all?knowledgeBaseId=${kbId}&limit=100`, 'services');
                    kbFiles = filesResponse.data?.data?.files || filesResponse.data?.files || [];
                } catch (error) {
                }

                try {
                    // Fetch trained URLs/pages (uses services.leadconnectorhq.com)
                    const urlsResponse = await window.ghlUtilsRevex.get(`/conversations-ai/train/pages/all?locationId=${locationId}&page=1&pageLength=100&query=&knowledgeBaseId=${kbId}`, 'services');
                    kbUrls = urlsResponse.data?.urls || [];
                } catch (error) {
                }

                try {
                    // Fetch FAQs (uses services.leadconnectorhq.com)
                    const faqsResponse = await window.ghlUtilsRevex.get(`/conversations-ai/train/faqs?locationId=${locationId}&knowledgeBaseIds=${kbId}`, 'services');
                    kbFaqs = faqsResponse.data?.faqs || [];
                } catch (error) {
                }

                try {
                    // Fetch rich text content (uses services.leadconnectorhq.com)
                    const richTextResponse = await window.ghlUtilsRevex.get(`/knowledge-base/rich-text/knowledge-base/${kbId}`, 'services');
                    kbRichText = richTextResponse.data?.data || richTextResponse.data || [];
                } catch (error) {
                }

                try {
                    // Fetch table operations status (uses services.leadconnectorhq.com)
                    const operationsResponse = await window.ghlUtilsRevex.get(`/knowledge-base/table/location/${locationId}/kb/${kbId}/operations`, 'services');
                    kbOperations = operationsResponse.data?.data || operationsResponse.data || null;
                } catch (error) {
                }

                // Extract kbMetadata from details if available
                const metadata = kbDetails?.kbMetadata || {};

                const enrichedKB = {
                    ...kb,
                    // Basic info
                    id: kbId,
                    name: apiData.name || kb.name || '',
                    isDefault: apiData.isDefault || kb.isDefault || false,
                    createdAt: apiData.createdAt || kb.createdAt || '',
                    // Details from detailed endpoint
                    description: kbDetails?.description || kb.description || '',
                    deleted: kbDetails?.deleted !== undefined ? kbDetails.deleted : false,
                    // Metadata counts from KB details
                    metadataFaqCount: metadata.faqs || 0,
                    metadataUrlCount: metadata.urls || 0,
                    metadataRichTextCount: metadata.richText || 0,
                    metadataFileCount: metadata.files || 0,
                    metadataWebSearchCount: metadata.webSearches || 0,
                    metadataTableCount: metadata.tables || 0,
                    // File statistics (from files endpoint)
                    totalFiles: kbFiles.length || 0,
                    fileTypes: kbFiles.length > 0 ? [...new Set(kbFiles.map(f => f.fileType || f.type || f.mimeType).filter(Boolean))].join('; ') : '',
                    totalFileSize: kbFiles.reduce((sum, f) => sum + (f.size || 0), 0),
                    fileNames: kbFiles.length > 0 ? kbFiles.map(f => f.name || f.fileName).filter(Boolean).join('; ') : '',
                    // URL/Pages statistics
                    totalUrls: kbUrls.length || 0,
                    urlTitles: kbUrls.length > 0 ? kbUrls.map(u => u.title).filter(Boolean).join('; ') : '',
                    urlStatuses: kbUrls.length > 0 ? [...new Set(kbUrls.map(u => u.status).filter(Boolean))].join('; ') : '',
                    urlList: kbUrls.length > 0 ? kbUrls.map(u => u.url).filter(Boolean).join('; ') : '',
                    // FAQ statistics
                    totalFaqs: kbFaqs.length || 0,
                    faqQuestions: kbFaqs.length > 0 ? kbFaqs.map(f => f.question).filter(Boolean).join(' | ') : '',
                    faqAnswers: kbFaqs.length > 0 ? kbFaqs.map(f => f.answer).filter(Boolean).join(' | ') : '',
                    // Rich text statistics
                    totalRichText: Array.isArray(kbRichText) ? kbRichText.length : 0,
                    richTextTitles: Array.isArray(kbRichText) && kbRichText.length > 0 ? kbRichText.map(r => r.title || r.name).filter(Boolean).join('; ') : '',
                    // Operations status
                    operationsTotalFiles: kbOperations?.totalFiles || 0,
                    operationsReadyFiles: kbOperations?.readyFiles || 0,
                    operationsProcessingFiles: kbOperations?.processingFiles || 0,
                    operationsFailedFiles: kbOperations?.failedFiles || 0,
                    hasActiveOperations: kbOperations?.activeOperations?.length > 0 || false,
                    // Metadata
                    updatedAt: kbDetails?.updatedAt || apiData.updatedAt || kb.updatedAt || '',
                    updatedBy: apiData.updatedBy || kbDetails?.updatedBy || kb.updatedBy || '',
                    // Full API data
                    fullEnrichmentData: _includeFullEnrichmentData ? {
                        apiKB: apiData,
                        details: kbDetails,
                        files: kbFiles,
                        urls: kbUrls,
                        faqs: kbFaqs,
                        richText: kbRichText,
                        operations: kbOperations
                    } : undefined
                };

                enrichedKBs.push(enrichedKB);
            } else {
                enrichedKBs.push(kb);
            }

            // Add delay to avoid rate limiting
            if (i < knowledgeBases.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
    } catch (error) {
        return knowledgeBases;
    }

    return enrichedKBs;
}

/**
 * Enrich conversation AI employees with configuration and performance metrics
 */
async function enrichConversationAI(aiEmployees, locationId) {
    if (!aiEmployees || aiEmployees.length === 0 || !locationId) {
        return aiEmployees;
    }

    const enrichedEmployees = [];

    try {
        // Fetch all AI employees from API (uses services.leadconnectorhq.com)
        const endpoint = `/ai-employees/employees/search?limit=1000&query=&locationId=${locationId}`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint, 'services');
        const apiEmployees = response.data?.employees || response.data || [];

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
            } else {
                enrichedEmployees.push(employee);
            }
        }
    } catch (error) {
        return aiEmployees;
    }

    return enrichedEmployees;
}

/**
 * Enrich Voice AI Agents with full configuration details
 */
async function enrichVoiceAIAgents(agents, locationId) {
    if (!agents || agents.length === 0 || !locationId) {
        return agents;
    }

    const enrichedAgents = [];

    try {
        await window.ghlUtilsRevex.waitForReady();

        for (let i = 0; i < agents.length; i++) {
            const agent = agents[i];
            const agentId = agent._id || agent.id;
            const agentName = agent.agentName || agent.name || 'Unnamed Agent';

            try {
                // Fetch full agent details
                const detailsEndpoint = `/voice-ai/agents/${agentId}?locationId=${locationId}`;
                const detailsResponse = await window.ghlUtilsRevex.get(detailsEndpoint);
                const agentDetails = detailsResponse.data || detailsResponse;

                const enrichedAgent = {
                    // Basic info
                    _id: agentDetails._id || agentId,
                    agentName: agentDetails.agentName || agentName,
                    agentStatus: agentDetails.agentStatus || 'UNKNOWN',
                    type: agentDetails.type || agent.type || 'AGENT',
                    provider: agentDetails.provider || 'RETELL',
                    providerVersion: agentDetails.providerVersion || agent.providerVersion || '',
                    // Business info
                    businessName: agentDetails.businessName || '',
                    timezone: agentDetails.timezone || agent.timezone || '',
                    // Prompt and messaging
                    agentWelcomeMessage: agentDetails.agentWelcomeMessage || agentDetails.welcomeMessage || '',
                    agentPrompt: agentDetails.agentPrompt || '',
                    // AI disclaimer configuration
                    outboundDisclaimerType: agentDetails.aiDisclaimerConfiguration?.outboundDisclaimerType || '',
                    outboundDisclaimerMessage: agentDetails.aiDisclaimerConfiguration?.outboundDisclaimerMessage || '',
                    outboundIntentMessage: agentDetails.aiDisclaimerConfiguration?.outboundIntentMessage || '',
                    // Settings
                    llmModel: agentDetails.llmModel || '',
                    isInboundActive: agentDetails.isInboundActive !== undefined ? agentDetails.isInboundActive : false,
                    advancedSettingsEnabled: agentDetails.advancedSettingsEnabled !== undefined ? agentDetails.advancedSettingsEnabled : false,
                    isAgentAsBackupDisabled: agentDetails.isAgentAsBackupDisabled !== undefined ? agentDetails.isAgentAsBackupDisabled : false,
                    // Agent settings details
                    patienceLevel: agentDetails.agentSettings?.patienceLevel || '',
                    backgroundSound: agentDetails.agentSettings?.backgroundSound || '',
                    maxCallDuration: agentDetails.agentSettings?.maxCallDuration || 0,
                    voiceTemperature: agentDetails.agentSettings?.voiceTemperature || 0,
                    voiceSpeed: agentDetails.agentSettings?.voiceSpeed || 0,
                    voiceVolume: agentDetails.agentSettings?.voiceVolume || 0,
                    interruptionSensitivity: agentDetails.agentSettings?.interruptionSensitivity || 0,
                    modelTemperature: agentDetails.agentSettings?.modelTemperature || 0,
                    denoisingMode: agentDetails.agentSettings?.denoisingMode || '',
                    enableBackchannel: agentDetails.agentSettings?.enableBackchannel !== undefined ? agentDetails.agentSettings.enableBackchannel : false,
                    backchannelFrequency: agentDetails.agentSettings?.backchannelFrequency || 0,
                    backchannelWords: agentDetails.agentSettings?.backchannelWords?.join('; ') || '',
                    sendUserIdleReminders: agentDetails.agentSettings?.sendUserIdleReminders !== undefined ? agentDetails.agentSettings.sendUserIdleReminders : false,
                    reminderAfterIdleTimeSeconds: agentDetails.agentSettings?.reminderAfterIdleTimeSeconds || 0,
                    reminderFrequency: agentDetails.agentSettings?.reminderFrequency || 0,
                    // Voice settings
                    voiceId: agentDetails.agentSettings?.voice?.voiceId || '',
                    voiceName: agentDetails.agentSettings?.voice?.name || '',
                    voiceProvider: agentDetails.agentSettings?.voice?.provider || '',
                    // Language
                    languageCode: agentDetails.agentSettings?.language?.code || '',
                    languageName: agentDetails.agentSettings?.language?.name || '',
                    // Translation
                    translationEnabled: agentDetails.translation?.enabled !== undefined ? agentDetails.translation.enabled : false,
                    // Actions summary
                    totalActions: agentDetails.actions?.length || 0,
                    actionTypes: agentDetails.actions?.length > 0
                        ? [...new Set(agentDetails.actions.map(a => a.actionType).filter(Boolean))].join('; ')
                        : '',
                    actionNames: agentDetails.actions?.length > 0
                        ? agentDetails.actions.map(a => a.name).filter(Boolean).join('; ')
                        : '',
                    // Knowledge bases
                    knowledgeBaseIds: agentDetails.knowledgeBaseIds?.join('; ') || '',
                    totalKnowledgeBases: agentDetails.knowledgeBaseIds?.length || 0,
                    // Call transfer actions
                    callTransferActionsCount: agentDetails.callTransferActions?.length || 0,
                    callTransferNumbers: agentDetails.callTransferActions?.length > 0
                        ? agentDetails.callTransferActions.map(a => a.transferToValue).filter(Boolean).join('; ')
                        : '',
                    // Data extraction fields
                    contactFieldActionsCount: agentDetails.contactFieldActions?.length || 0,
                    contactFieldNames: agentDetails.contactFieldActions?.length > 0
                        ? agentDetails.contactFieldActions.map(a => a.contactFieldName).filter(Boolean).join('; ')
                        : '',
                    // Appointment booking
                    hasAppointmentBooking: agentDetails.appointmentBookingAction ? true : false,
                    appointmentCalendarId: agentDetails.appointmentBookingAction?.calendarId || '',
                    appointmentDaysOffering: agentDetails.appointmentBookingAction?.daysOfOfferingDates || 0,
                    appointmentSlotsPerDay: agentDetails.appointmentBookingAction?.slotsPerDay || 0,
                    // Workflows
                    callEndWorkflowIds: agentDetails.callEndWorkflowIds?.join('; ') || '',
                    totalCallEndWorkflows: agentDetails.callEndWorkflowIds?.length || 0,
                    // Notification settings
                    sendPostCallNotificationToAdmins: agentDetails.sendPostCallNotificationTo?.admins !== undefined ? agentDetails.sendPostCallNotificationTo.admins : false,
                    sendPostCallNotificationToAllUsers: agentDetails.sendPostCallNotificationTo?.allUsers !== undefined ? agentDetails.sendPostCallNotificationTo.allUsers : false,
                    sendPostCallNotificationToAssignedUser: agentDetails.sendPostCallNotificationTo?.contactAssignedUser !== undefined ? agentDetails.sendPostCallNotificationTo.contactAssignedUser : false,
                    // Snapshot info
                    snapshotId: agentDetails.snapshotId || agent.snapshotId || '',
                    snapshotStatusId: agentDetails.snapshotStatusId || '',
                    originId: agentDetails.originId || '',
                    // Metadata
                    createdAt: agentDetails.createdAt || '',
                    updatedAt: agentDetails.updatedAt || agent.updatedAt || '',
                    isDeleted: agentDetails.isDeleted !== undefined ? agentDetails.isDeleted : false,
                    isAgentCreationInProgress: agentDetails.isAgentCreationInProgress !== undefined ? agentDetails.isAgentCreationInProgress : false,
                    // Provider IDs
                    retellLlmId: agentDetails.retellLlmId || '',
                    providerAgentId: agentDetails.providerAgentId || '',
                    // Full data
                    fullEnrichmentData: _includeFullEnrichmentData ? agentDetails : undefined
                };

                enrichedAgents.push(enrichedAgent);
                // Small delay to avoid rate limiting
                if (i < agents.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (error) {
                // Add basic agent data on error
                enrichedAgents.push({
                    _id: agentId,
                    agentName: agentName,
                    agentStatus: 'UNKNOWN',
                    type: agent.type || 'AGENT',
                    timezone: agent.timezone || '',
                    updatedAt: agent.updatedAt || '',
                    isInboundActive: agent.isInboundActive !== undefined ? agent.isInboundActive : false,
                    snapshotId: agent.snapshotId || '',
                    error: error.message
                });
            }
        }
    } catch (error) {
        return agents;
    }

    return enrichedAgents;
}

/**
 * Enrich AI Employees (Conversational Agents) with full configuration details
 */
async function enrichAIEmployees(employees, locationId) {
    if (!employees || employees.length === 0 || !locationId) {
        return employees;
    }

    const enrichedEmployees = [];

    try {
        await window.ghlUtilsRevex.waitForReady();

        for (let i = 0; i < employees.length; i++) {
            const employee = employees[i];
            const employeeId = employee.id || employee._id;
            const employeeName = employee.name || 'Unnamed Employee';

            const enrichedEmployee = {
                // Basic info
                id: employeeId,
                name: employee.name || '',
                mode: employee.mode || 'off',
                botType: employee.botType || '',
                isPrimary: employee.isPrimary !== undefined ? employee.isPrimary : false,
                deleted: employee.deleted !== undefined ? employee.deleted : false,
                // Configuration
                waitTime: employee.waitTime || 0,
                waitTimeUnit: employee.waitTimeUnit || 'seconds',
                sleepEnabled: employee.sleepEnabled !== undefined ? employee.sleepEnabled : false,
                sleepTime: employee.sleepTime || 0,
                sleepTimeUnit: employee.sleepTimeUnit || 'hours',
                autoPilotMaxMessages: employee.autoPilotMaxMessages || 0,
                // Goal
                goalType: employee.goal?.type || '',
                goalPrompt: employee.goal?.prompt || '',
                goalActionId: employee.goal?.actionId || '',
                // LLM settings
                llmPrimary: employee.llm?.primary || '',
                llmSecondary: employee.llm?.secondary || '',
                // Channels
                channels: employee.channels?.map(c => c.name).join('; ') || '',
                primaryChannels: employee.channels?.filter(c => c.isPrimary).map(c => c.name).join('; ') || '',
                totalChannels: employee.channels?.length || 0,
                // Actions
                totalActions: employee.actions?.length || 0,
                actionTypes: employee.actions?.length > 0
                    ? [...new Set(employee.actions.map(a => a.type).filter(Boolean))].join('; ')
                    : '',
                actionIds: employee.actions?.length > 0
                    ? employee.actions.map(a => a.id).filter(Boolean).join('; ')
                    : '',
                // Knowledge bases
                knowledgeBaseIds: employee.knowledgeBaseIds?.join('; ') || '',
                totalKnowledgeBases: employee.knowledgeBaseIds?.length || 0,
                // Media handling
                respondToAudio: employee.respondToAudio !== undefined ? employee.respondToAudio : false,
                respondToImages: employee.respondToImages !== undefined ? employee.respondToImages : false,
                // Appointment settings
                cancelEnabled: employee.cancelEnabled !== undefined ? employee.cancelEnabled : false,
                rescheduleEnabled: employee.rescheduleEnabled !== undefined ? employee.rescheduleEnabled : false,
                // Prompt
                promptId: employee.prompt || '',
                // Snapshot
                snapshotOriginId: employee.snapshotOriginId || '',
                // Metadata
                createdAt: employee.createdAt || '',
                updatedAt: employee.updatedAt || '',
                updatedByUserId: employee.updatedBy?.userId || '',
                updatedByTimestamp: employee.updatedBy?.timestamp || '',
                // Errors
                errors: employee.errors?.length > 0 ? employee.errors.join('; ') : '',
                // Full data
                fullEnrichmentData: _includeFullEnrichmentData ? employee : undefined
            };

            enrichedEmployees.push(enrichedEmployee);
        }
    } catch (error) {
        return employees;
    }

    return enrichedEmployees;
}

/**
 * Enrich documents/proposals templates with full details
 */
async function enrichDocuments(documents, locationId) {
    if (!documents || documents.length === 0 || !locationId) {
        return documents;
    }

    const enrichedDocs = [];

    try {
        await window.ghlUtilsRevex.waitForReady();

        for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            const docId = doc.id || doc._id;
            const docName = doc.name || doc.title || 'Unnamed Document';

            const enrichedDoc = {
                // Basic info
                id: docId,
                name: doc.name || '',
                title: doc.title || '',
                type: doc.type || '',
                status: doc.status || '',
                // Template details
                templateType: doc.templateType || doc.type || '',
                category: doc.category || '',
                description: doc.description || '',
                // Settings
                isDefault: doc.isDefault !== undefined ? doc.isDefault : false,
                isPublic: doc.isPublic !== undefined ? doc.isPublic : false,
                // Content info
                hasContent: doc.content ? true : false,
                contentLength: doc.content ? doc.content.length : 0,
                // Pricing/totals
                total: doc.total || doc.amount || 0,
                currency: doc.currency || 'USD',
                // Line items summary
                totalLineItems: doc.lineItems?.length || doc.items?.length || 0,
                lineItemNames: doc.lineItems?.map(item => item.name).join('; ') || doc.items?.map(item => item.name).join('; ') || '',
                // Associations
                contactId: doc.contactId || '',
                opportunityId: doc.opportunityId || '',
                pipelineId: doc.pipelineId || '',
                // Dates
                createdAt: doc.createdAt || '',
                updatedAt: doc.updatedAt || '',
                sentAt: doc.sentAt || '',
                expiresAt: doc.expiresAt || doc.expirationDate || '',
                // Signature info
                signatureRequired: doc.signatureRequired !== undefined ? doc.signatureRequired : false,
                signedAt: doc.signedAt || '',
                signedBy: doc.signedBy || '',
                // Creator info
                createdBy: doc.createdBy || doc.userId || '',
                updatedBy: doc.updatedBy || '',
                // Location
                locationId: doc.locationId || locationId,
                // Full data
                fullEnrichmentData: _includeFullEnrichmentData ? doc : undefined
            };

            enrichedDocs.push(enrichedDoc);
        }
    } catch (error) {
        return documents;
    }

    return enrichedDocs;
}

/**
 * Enrich snippets with full details
 */
async function enrichSnippets(snippets, locationId) {
    if (!snippets || snippets.length === 0 || !locationId) {
        return snippets;
    }

    const enrichedSnippets = [];

    try {
        for (let i = 0; i < snippets.length; i++) {
            const snippet = snippets[i];
            const snippetId = snippet._id || snippet.id;
            const snippetName = snippet.name || 'Unnamed Snippet';

            const enrichedSnippet = {
                // Basic info
                id: snippetId,
                name: snippet.name || '',
                type: snippet.type || 'sms',
                // Template content
                body: snippet.template?.body || '',
                bodyLength: snippet.template?.body?.length || 0,
                hasAttachments: snippet.template?.attachments?.length > 0 || false,
                attachmentCount: snippet.template?.attachments?.length || 0,
                // Status
                deleted: snippet.deleted !== undefined ? snippet.deleted : false,
                // Location
                locationId: snippet.locationId || locationId,
                // Origin (for snapshots)
                originId: snippet.originId || '',
                // Dates
                dateAdded: snippet.dateAdded || '',
                dateUpdated: snippet.dateUpdated || '',
                updatedAt: snippet.updatedAt || '',
                // Full data
                fullEnrichmentData: _includeFullEnrichmentData ? snippet : undefined
            };

            enrichedSnippets.push(enrichedSnippet);
        }

    } catch (error) {
        return snippets;
    }

    return enrichedSnippets;
}

/**
 * Enrich custom objects with schema and configuration details
 */
async function enrichCustomObjects(customObjects, locationId) {
    if (!customObjects || customObjects.length === 0 || !locationId) {
        return customObjects;
    }

    const enrichedObjects = [];

    try {
        // Fetch all custom objects from API
        const endpoint = `/objects/?locationId=${locationId}`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);
        const apiObjects = response.data?.objects || response.data || [];

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
            } else {
                enrichedObjects.push(obj);
            }
        }
    } catch (error) {
        return customObjects;
    }

    return enrichedObjects;
}

/**
 * Enrich dashboards with widget configurations and permissions
 */
async function enrichDashboards(dashboards, locationId) {
    if (!dashboards || dashboards.length === 0 || !locationId) {
        return dashboards;
    }

    const enrichedDashboards = [];

    try {
        // Fetch all dashboards from API
        const endpoint = `/reporting/dashboards?locationId=${locationId}`;
        await window.ghlUtilsRevex.waitForReady();
        const response = await window.ghlUtilsRevex.get(endpoint);

        // New API structure: response.data contains { defaultDashboardId, dashboard: [], sharedDashboards: [] }
        const apiData = response.data || {};
        const userDashboards = apiData.dashboard || [];
        const sharedDashboards = apiData.sharedDashboards || [];
        const allApiDashboards = [...userDashboards, ...sharedDashboards];
        const defaultDashboardId = apiData.defaultDashboardId || null;

        // Create a map for quick lookup
        const dashboardMap = new Map();
        allApiDashboards.forEach(dashboard => {
            const dashboardId = dashboard.id || dashboard._id;
            if (dashboardId) {
                dashboardMap.set(dashboardId, {
                    ...dashboard,
                    isShared: sharedDashboards.some(d => (d.id || d._id) === dashboardId),
                    isDefault: dashboardId === defaultDashboardId || dashboard.isDefault === true
                });
            }
        });

        // Enrich each dashboard
        for (let i = 0; i < dashboards.length; i++) {
            const dashboard = dashboards[i];
            const dashboardId = dashboard.id || dashboard._id;
            const dashboardName = dashboard.name || dashboard.title || 'Unnamed Dashboard';

            const apiDashboard = dashboardMap.get(dashboardId);

            if (apiDashboard && dashboardId) {
                // Try to fetch detailed information
                let dashboardDetails = null;
                let widgets = [];
                let dashboardWidgets = [];
                let permission = null;

                try {
                    // Fetch dashboard details - new structure includes dashboardWidgets, widgets, dashboard, permission
                    const detailsResponse = await window.ghlUtilsRevex.get(`/reporting/dashboards/${dashboardId}?locationId=${locationId}`);
                    const detailsData = detailsResponse.data || {};

                    dashboardDetails = detailsData.dashboard || null;
                    widgets = detailsData.widgets || [];
                    dashboardWidgets = detailsData.dashboardWidgets || [];
                    permission = detailsData.permission || null;

                } catch (error) {
                }

                // Extract widget information
                const widgetTitles = widgets.map(w => w.title).filter(Boolean).join('; ');
                const widgetModules = [...new Set(widgets.map(w => w.module || w.moduleName).filter(Boolean))].join('; ');
                const widgetChartTypes = [...new Set(widgets.map(w => w.chartType).filter(Boolean))].join('; ');
                const widgetGroups = [...new Set(widgets.map(w => w.group).filter(Boolean))].join('; ');

                // Extract custom fields used in widget filters
                const customFieldsUsed = new Set();
                widgets.forEach(widget => {
                    if (widget.options && widget.options.filters) {
                        extractCustomFieldsFromFilters(widget.options.filters, customFieldsUsed);
                    }
                    if (widget.savedOptionPairs) {
                        widget.savedOptionPairs.forEach(pair => {
                            if (pair.customFields) {
                                pair.customFields.forEach(cf => {
                                    if (cf.label) customFieldsUsed.add(cf.label);
                                });
                            }
                        });
                    }
                });

                const enrichedDashboard = {
                    ...dashboard,
                    // Basic info
                    title: dashboardDetails?.title || apiDashboard.title || dashboard.title || dashboard.name || '',
                    name: dashboardDetails?.title || apiDashboard.title || dashboard.name || dashboard.title || '',
                    type: dashboardDetails?.type || 'custom',
                    featureType: dashboardDetails?.featureType || 'dashboard',
                    // Widget information
                    totalWidgets: widgets.length,
                    totalDashboardWidgets: dashboardWidgets.length,
                    widgetTitles: widgetTitles,
                    widgetModules: widgetModules,
                    widgetChartTypes: widgetChartTypes,
                    widgetGroups: widgetGroups,
                    customFieldsUsed: Array.from(customFieldsUsed).join('; '),
                    // Dashboard properties
                    hasCustomWidgets: dashboardDetails?.hasCustomWidgets || false,
                    isShared: apiDashboard.isShared || dashboardDetails?.isShared || false,
                    isPrivate: dashboardDetails?.isPrivate || false,
                    isDefault: apiDashboard.isDefault || dashboardDetails?.isDefault || false,
                    isFavorite: apiDashboard.isFavorite || false,
                    // Permission
                    permission: permission || 'unknown',
                    // Owner and metadata
                    ownerId: dashboardDetails?.ownerId || '',
                    ownerRole: dashboardDetails?.ownerMeta?.role || '',
                    ownerType: dashboardDetails?.ownerMeta?.type || '',
                    companyId: dashboardDetails?.companyId || '',
                    // Theme
                    themeName: dashboardDetails?.themeConfig?.themeName || '',
                    titleColor: dashboardDetails?.themeConfig?.titleColor || '',
                    backgroundColor: dashboardDetails?.themeConfig?.backgroundColor || '',
                    // Timestamps
                    createdAt: dashboardDetails?.createdAt || apiDashboard.createdAt || dashboard.createdAt || '',
                    updatedAt: dashboardDetails?.updatedAt || apiDashboard.updatedAt || dashboard.updatedAt || '',
                    createdBy: dashboardDetails?.createdBy?.altId || dashboard.createdBy || '',
                    updatedBy: dashboardDetails?.updatedBy?.altId || dashboard.updatedBy || '',
                    // Full API data
                    fullEnrichmentData: {
                        apiDashboard: apiDashboard,
                        dashboardDetails: dashboardDetails,
                        widgets: widgets,
                        dashboardWidgets: dashboardWidgets,
                        permission: permission
                    }
                };

                enrichedDashboards.push(enrichedDashboard);
            } else {
                enrichedDashboards.push(dashboard);
            }

            // Add delay to avoid rate limiting
            if (i < dashboards.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
    } catch (error) {
        return dashboards;
    }

    return enrichedDashboards;
}

/**
 * Extract custom field references from widget filters
 */
function extractCustomFieldsFromFilters(filters, customFieldsSet) {
    if (!filters || !Array.isArray(filters)) return;

    filters.forEach(filter => {
        // Handle nested filter groups
        if (filter.filters && Array.isArray(filter.filters)) {
            extractCustomFieldsFromFilters(filter.filters, customFieldsSet);
        }

        // Extract custom field from filter field path
        if (filter.field && filter.field.includes('custom_fields.')) {
            const customFieldId = filter.field.replace('custom_fields.', '');
            if (customFieldId) customFieldsSet.add(customFieldId);
        }

        // Extract from uiMeta
        if (filter.uiMeta?.fieldMeta?.customField?.savedOptionPairs) {
            filter.uiMeta.fieldMeta.customField.savedOptionPairs.forEach(pair => {
                if (pair.label) customFieldsSet.add(pair.label);
            });
        }
    });
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

    // Build final column order: priority columns + other columns + Full Enrichment Data (if enabled)
    const headers = [
        ...priorityColumns.map(col => columnNames[col] || col),
        ...Array.from(allKeys).sort()
    ];

    const fullColumnKeys = [...priorityColumns, ...Array.from(allKeys).sort()];

    // Add Full Enrichment Data column only if enabled (uses module-level setting)
    if (_includeFullEnrichmentData) {
        headers.push('Full Enrichment Data');
        fullColumnKeys.push('fullEnrichmentData');
    }

    // Uppercase all headers for readability
    const displayHeaders = headers.map(h => h.toUpperCase());

    // Create data array starting with formatted headers
    const dataArray = [displayHeaders];

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
