/**
 * GHL Snapshot Export - Popup UI Controller
 */

// DOM elements
const exportManualButton = document.getElementById('exportManualButton');
const exportSelectedButton = document.getElementById('exportSelectedButton');
const snapshotSelect = document.getElementById('snapshotSelect');
const exportFormatSelect = document.getElementById('exportFormat');
const openaiKeyInput = document.getElementById('openaiKey');
const enableAICheckbox = document.getElementById('enableAI');
const snapshotIdInput = document.getElementById('snapshotId');
const companyIdInput = document.getElementById('companyId');
const progress = document.getElementById('progress');
const progressText = document.getElementById('progressText');
const progressBar = document.getElementById('progressBar');
const messageDiv = document.getElementById('message');

// Store snapshots and companyId
let snapshots = [];
let currentCompanyId = null;

// Load saved settings
chrome.storage.local.get(['openaiApiKey', 'aiAnalysisEnabled'], (result) => {
  if (result.openaiApiKey) {
    openaiKeyInput.value = result.openaiApiKey;
  }
  enableAICheckbox.checked = result.aiAnalysisEnabled !== false; // Default to true
});

// Save OpenAI key when it changes
openaiKeyInput.addEventListener('change', () => {
  const key = openaiKeyInput.value.trim();
  chrome.storage.local.set({ openaiApiKey: key });
});

// Save AI enabled setting when it changes
enableAICheckbox.addEventListener('change', () => {
  chrome.storage.local.set({ aiAnalysisEnabled: enableAICheckbox.checked });
});

/**
 * Export with manual IDs
 */
exportManualButton.addEventListener('click', async () => {
  try {
    const snapshotId = snapshotIdInput.value.trim();
    const companyId = companyIdInput.value.trim();

    if (!snapshotId || !companyId) {
      showMessage('Please enter both Snapshot ID and Company ID', 'error');
      return;
    }

    // Disable button
    exportManualButton.disabled = true;

    // Show progress
    progress.style.display = 'block';
    messageDiv.style.display = 'none';
    progressBar.style.width = '0%';
    progressText.textContent = 'Preparing export...';

    // Get active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) {
      throw new Error('No active tab found');
    }

    // Check if on GHL page
    if (!tabs[0].url || !tabs[0].url.includes('gohighlevel.com')) {
      showMessage(
        'Please navigate to a GoHighLevel page first. The extension needs to run on a GHL page to access authentication.',
        'error'
      );
      resetUI();
      return;
    }

    // Get export format
    const format = exportFormatSelect ? exportFormatSelect.value : 'xlsx';

    console.log('[Popup] Sending export request with IDs:', { snapshotId, companyId, format });

    // Send export request with IDs
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'exportSnapshotWithIds',
      snapshotId: snapshotId,
      companyId: companyId,
      format: format
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Popup] Export error:', chrome.runtime.lastError);
        showMessage(
          'Unable to communicate with the page. Please refresh the GHL page and try again.\n\nError: ' + chrome.runtime.lastError.message,
          'error'
        );
        resetUI();
        return;
      }

      console.log('[Popup] Response received:', response);

      if (!response || !response.success) {
        showMessage(response?.error || 'Export failed', 'error');
        resetUI();
        return;
      }

      // Success message will be shown by progress listener
    });

  } catch (error) {
    console.error('[Popup] Export error:', error);
    showMessage(error.message, 'error');
    resetUI();
  }
});

/**
 * Listen for progress updates
 */
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'snapshotExportProgress') {
    progressText.textContent = request.message;
    progressBar.style.width = request.progress + '%';

    // If complete, show success message
    if (request.progress === 100) {
      setTimeout(() => {
        showMessage('Export completed successfully! Check your downloads folder.', 'success');
        resetUI();
      }, 500);
    }
  }
});

/**
 * Show message
 */
function showMessage(text, type) {
  messageDiv.textContent = text;
  messageDiv.className = `message ${type}`;
  messageDiv.style.display = 'block';
}

/**
 * Export selected snapshot from dropdown
 */
exportSelectedButton.addEventListener('click', async () => {
  try {
    const selectedValue = snapshotSelect.value;
    if (!selectedValue) {
      showMessage('Please select a snapshot', 'error');
      return;
    }

    // Parse snapshotId from value (format: "snapshotId")
    const snapshotId = selectedValue;
    const companyId = currentCompanyId;

    if (!companyId) {
      showMessage('Company ID not found. Please use manual export.', 'error');
      return;
    }

    // Get export format
    const format = exportFormatSelect ? exportFormatSelect.value : 'xlsx';

    console.log('[Popup] Exporting selected snapshot:', snapshotId, 'format:', format);

    // Disable button
    exportSelectedButton.disabled = true;

    // Show progress
    progress.style.display = 'block';
    messageDiv.style.display = 'none';
    progressBar.style.width = '0%';
    progressText.textContent = 'Preparing export...';

    // Get active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) {
      throw new Error('No active tab found');
    }

    // Send export request
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'exportSnapshotWithIds',
      snapshotId: snapshotId,
      companyId: companyId,
      format: format
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Popup] Export error:', chrome.runtime.lastError);
        showMessage('Unable to export. Please refresh the GHL page and try again.', 'error');
        resetUI();
        return;
      }

      if (!response || !response.success) {
        showMessage(response?.error || 'Export failed', 'error');
        resetUI();
        return;
      }
    });

  } catch (error) {
    console.error('[Popup] Export error:', error);
    showMessage(error.message, 'error');
    resetUI();
  }
});

/**
 * Fetch snapshots list
 */
async function fetchSnapshotsList(companyId) {
  try {
    console.log('[Popup] Fetching snapshots for company:', companyId || '(will auto-detect)');

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) {
      throw new Error('No active tab');
    }

    console.log('[Popup] Sending fetchSnapshotsList message to tab:', tabs[0].id);

    // Send request to content script to fetch snapshots
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'fetchSnapshotsList',
      companyId: companyId
    }, (response) => {
      console.log('[Popup] Received response:', response);
      console.log('[Popup] lastError:', chrome.runtime.lastError);

      if (chrome.runtime.lastError) {
        console.error('[Popup] Fetch error:', chrome.runtime.lastError);
        snapshotSelect.innerHTML = '<option value="">Extension not loaded. Please refresh the page.</option>';
        return;
      }

      if (!response) {
        console.error('[Popup] No response received');
        snapshotSelect.innerHTML = '<option value="">No response. Please refresh the page.</option>';
        return;
      }

      if (!response.success) {
        console.error('[Popup] Fetch failed:', response.error);
        snapshotSelect.innerHTML = `<option value="">Error: ${response.error || 'Unknown error'}</option>`;
        return;
      }

      // Populate dropdown
      snapshots = response.snapshots || [];
      console.log('[Popup] Loaded', snapshots.length, 'snapshots:', snapshots);

      // Store companyId if returned
      if (response.companyId) {
        currentCompanyId = response.companyId;
        companyIdInput.value = response.companyId;
        console.log('[Popup] Stored company ID:', currentCompanyId);
      }

      if (snapshots.length === 0) {
        snapshotSelect.innerHTML = '<option value="">No snapshots found</option>';
        return;
      }

      // Build options
      snapshotSelect.innerHTML = '<option value="">Select a snapshot...</option>';
      snapshots.forEach(snapshot => {
        const option = document.createElement('option');
        const snapshotId = snapshot._id || snapshot.id; // API uses _id, not id
        option.value = snapshotId;
        option.textContent = `${snapshot.name || 'Untitled'} (${snapshotId.substring(0, 8)}...)`;
        snapshotSelect.appendChild(option);
      });

      console.log('[Popup] Dropdown populated with', snapshots.length, 'snapshots');
    });

  } catch (error) {
    console.error('[Popup] Error fetching snapshots:', error);
    snapshotSelect.innerHTML = '<option value="">Error: ' + error.message + '</option>';
  }
}

/**
 * Reset UI
 */
function resetUI() {
  exportManualButton.disabled = false;
  exportSelectedButton.disabled = false;

  setTimeout(() => {
    progress.style.display = 'none';
    progressBar.style.width = '0%';
  }, 2000);
}

/**
 * Auto-load snapshots on popup open
 */
chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  console.log('[Popup] Initializing, active tab:', tabs[0]?.url);

  if (!tabs[0]) {
    console.error('[Popup] No active tab found');
    snapshotSelect.innerHTML = '<option value="">No active tab</option>';
    return;
  }

  // Check if on GHL page
  if (!tabs[0].url || !tabs[0].url.includes('gohighlevel.com')) {
    console.warn('[Popup] Not on a GHL page');
    snapshotSelect.innerHTML = '<option value="">Please navigate to a GHL page</option>';
    return;
  }

  console.log('[Popup] On GHL page, fetching snapshots...');

  // Fetch snapshots without companyId - content script will get it from user endpoint
  fetchSnapshotsList(null);
});
