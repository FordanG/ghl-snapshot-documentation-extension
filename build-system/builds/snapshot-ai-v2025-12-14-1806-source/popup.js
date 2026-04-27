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
const selectAllAssetsButton = document.getElementById('selectAllAssets');
const deselectAllAssetsButton = document.getElementById('deselectAllAssets');

// Location export DOM elements
const exportLocationButton = document.getElementById('exportLocationButton');
const currentLocationIdInput = document.getElementById('currentLocationId');
const locationProgress = document.getElementById('locationProgress');
const locationProgressText = document.getElementById('locationProgressText');
const locationProgressBar = document.getElementById('locationProgressBar');
const locationMessageDiv = document.getElementById('locationMessage');

// License DOM elements
const licenseCodeInput = document.getElementById('licenseCode');
const activateLicenseBtn = document.getElementById('activateLicenseBtn');
const deactivateLicenseBtn = document.getElementById('deactivateLicenseBtn');
const licenseStatusContainer = document.getElementById('licenseStatusContainer');
const licenseInputContainer = document.getElementById('licenseInputContainer');
const licenseUsageInfo = document.getElementById('licenseUsageInfo');
const licenseMessage = document.getElementById('licenseMessage');

// OpenAI key UI elements
const openaiKeyInputContainer = document.getElementById('openaiKeyInputContainer');
const openaiKeySavedContainer = document.getElementById('openaiKeySavedContainer');
const openaiKeyMasked = document.getElementById('openaiKeyMasked');
const testOpenaiKeyBtn = document.getElementById('testOpenaiKey');
const changeOpenaiKeyBtn = document.getElementById('changeOpenaiKey');
const openaiKeyStatus = document.getElementById('openaiKeyStatus');
const includeFullEnrichmentCheckbox = document.getElementById('includeFullEnrichment');

// Export overlay DOM elements
const exportOverlay = document.getElementById('exportOverlay');
const exportOverlayType = document.getElementById('exportOverlayType');
const exportOverlayStatus = document.getElementById('exportOverlayStatus');
const exportOverlayBar = document.getElementById('exportOverlayBar');
const exportOverlayPercent = document.getElementById('exportOverlayPercent');
const dismissOverlayBtn = document.getElementById('dismissOverlayBtn');

// Store snapshots and companyId
let snapshots = [];
let currentCompanyId = null;
let isLicenseValid = false;
let isExportRunning = false;

// Load saved settings
chrome.storage.local.get(['openaiApiKey', 'aiAnalysisEnabled', 'includeFullEnrichment'], (result) => {
  console.log('[Popup] Loading AI settings:', { hasKey: !!result.openaiApiKey, aiEnabled: result.aiAnalysisEnabled, includeFullEnrichment: result.includeFullEnrichment });

  if (result.openaiApiKey) {
    // Show saved key UI instead of input
    showSavedKeyUI(result.openaiApiKey);
  } else {
    showKeyInputUI();
  }

  enableAICheckbox.checked = result.aiAnalysisEnabled === true;
  // Default to true if not set
  includeFullEnrichmentCheckbox.checked = result.includeFullEnrichment !== false;
});

// Show the saved key indicator UI
function showSavedKeyUI(key) {
  openaiKeyInputContainer.style.display = 'none';
  openaiKeySavedContainer.style.display = 'block';
  openaiKeyStatus.style.display = 'none';
  const maskedKey = key.substring(0, 7) + '...' + key.substring(key.length - 4);
  openaiKeyMasked.textContent = `API Key: ${maskedKey}`;
}

// Show the key input UI
function showKeyInputUI() {
  openaiKeyInputContainer.style.display = 'flex';
  openaiKeySavedContainer.style.display = 'none';
  openaiKeyInput.value = '';
}

// Change key button - switch back to input mode
changeOpenaiKeyBtn.addEventListener('click', () => {
  chrome.storage.local.get(['openaiApiKey'], (result) => {
    showKeyInputUI();
    if (result.openaiApiKey) {
      openaiKeyInput.value = result.openaiApiKey;
    }
  });
});

// Test OpenAI key button
testOpenaiKeyBtn.addEventListener('click', async () => {
  const key = openaiKeyInput.value.trim();

  if (!key) {
    showKeyStatus('Please enter an API key first', 'error');
    return;
  }

  if (!key.startsWith('sk-')) {
    showKeyStatus('Invalid key format - should start with sk-', 'error');
    return;
  }

  testOpenaiKeyBtn.disabled = true;
  testOpenaiKeyBtn.textContent = 'Testing...';
  showKeyStatus('Testing connection...', 'info');

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`
      }
    });

    if (response.ok) {
      showKeyStatus('API key is valid and working!', 'success');
      // Save the key and show saved UI
      chrome.storage.local.set({ openaiApiKey: key }, () => {
        console.log('[Popup] OpenAI key saved after successful test');
        setTimeout(() => {
          showSavedKeyUI(key);
        }, 1500);
      });
    } else {
      const error = await response.json().catch(() => ({}));
      showKeyStatus(`Invalid key: ${error.error?.message || response.statusText}`, 'error');
    }
  } catch (error) {
    showKeyStatus(`Connection error: ${error.message}`, 'error');
  } finally {
    testOpenaiKeyBtn.disabled = false;
    testOpenaiKeyBtn.textContent = 'Test';
  }
});

// Show status message for OpenAI key
function showKeyStatus(message, type) {
  openaiKeyStatus.style.display = 'block';
  openaiKeyStatus.textContent = message;

  if (type === 'success') {
    openaiKeyStatus.style.background = '#f0fdf4';
    openaiKeyStatus.style.color = '#166534';
    openaiKeyStatus.style.border = '1px solid #bbf7d0';
  } else if (type === 'error') {
    openaiKeyStatus.style.background = '#fef2f2';
    openaiKeyStatus.style.color = '#991b1b';
    openaiKeyStatus.style.border = '1px solid #fecaca';
  } else {
    openaiKeyStatus.style.background = '#eff6ff';
    openaiKeyStatus.style.color = '#1e40af';
    openaiKeyStatus.style.border = '1px solid #bfdbfe';
  }
}

// Save AI enabled setting when it changes
enableAICheckbox.addEventListener('change', () => {
  chrome.storage.local.set({ aiAnalysisEnabled: enableAICheckbox.checked }, () => {
    console.log('[Popup] AI analysis enabled:', enableAICheckbox.checked);
  });
});

// Save includeFullEnrichment setting when it changes
includeFullEnrichmentCheckbox.addEventListener('change', () => {
  chrome.storage.local.set({ includeFullEnrichment: includeFullEnrichmentCheckbox.checked }, () => {
    console.log('[Popup] Include full enrichment:', includeFullEnrichmentCheckbox.checked);
  });
});

/**
 * Show the export overlay
 * @param {string} type - 'snapshot' or 'location'
 */
function showExportOverlay(type) {
  isExportRunning = true;
  exportOverlay.classList.add('active');
  exportOverlayType.textContent = type === 'location'
    ? 'Exporting location assets...'
    : 'Exporting snapshot assets...';
  exportOverlayStatus.textContent = 'Preparing export...';
  exportOverlayBar.style.width = '0%';
  exportOverlayPercent.textContent = '0%';
  console.log('[Popup] Export overlay shown for:', type);
}

/**
 * Update the export overlay progress
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} message - Status message
 */
function updateExportOverlay(progress, message) {
  exportOverlayStatus.textContent = message;
  exportOverlayBar.style.width = progress + '%';
  exportOverlayPercent.textContent = Math.round(progress) + '%';
}

/**
 * Hide the export overlay
 */
function hideExportOverlay() {
  isExportRunning = false;
  exportOverlay.classList.remove('active');
  console.log('[Popup] Export overlay hidden');
}

/**
 * Dismiss overlay button handler - allows user to manually close stuck overlay
 */
dismissOverlayBtn.addEventListener('click', () => {
  console.log('[Popup] User dismissed export overlay');
  hideExportOverlay();
  // Clear the export state so it doesn't restore on next popup open
  chrome.storage.local.set({
    snapshotExportState: { isExporting: false, progress: 0, message: '' },
    locationExportState: { isExporting: false, progress: 0, message: '' }
  });
  // Reset UI
  exportManualButton.disabled = false;
  exportSelectedButton.disabled = false;
  exportLocationButton.disabled = false;
});

/**
 * Check if an export is already running and prevent starting a new one
 * @returns {boolean} - true if export can proceed, false if blocked
 */
function canStartExport() {
  if (isExportRunning) {
    alert('An export is already in progress. Please wait for it to complete.');
    return false;
  }
  return true;
}

/**
 * Restore export progress state when popup opens
 * This ensures progress is visible even if popup was closed during export
 */
async function restoreExportProgress() {
  try {
    const result = await chrome.storage.local.get(['snapshotExportState', 'locationExportState']);

    // Check for snapshot export in progress
    if (result.snapshotExportState && result.snapshotExportState.isExporting) {
      const state = result.snapshotExportState;
      // Skip restoring if it's an error state (progress = 0 with error message)
      if (state.progress === 0 && state.message && state.message.startsWith('Error:')) {
        console.log('[Popup] Skipping restore - export errored:', state.message);
        // Clear the error state
        chrome.storage.local.set({ snapshotExportState: { isExporting: false, progress: 0, message: '' } });
        return;
      }
      // Only restore if the export started within the last 10 minutes
      if (Date.now() - state.timestamp < 10 * 60 * 1000) {
        console.log('[Popup] Restoring snapshot export progress:', state);
        isExportRunning = true;
        exportOverlay.classList.add('active');
        exportOverlayType.textContent = 'Exporting snapshot assets...';
        updateExportOverlay(state.progress, state.message || 'Export in progress...');
        return; // Don't check location if snapshot is running
      } else {
        // Export state is stale (over 10 minutes old), clear it
        console.log('[Popup] Clearing stale snapshot export state');
        chrome.storage.local.set({ snapshotExportState: { isExporting: false, progress: 0, message: '' } });
      }
    }

    // Check for location export in progress
    if (result.locationExportState && result.locationExportState.isExporting) {
      const state = result.locationExportState;
      // Skip restoring if it's an error state (progress = 0 with error message)
      if (state.progress === 0 && state.message && state.message.startsWith('Error:')) {
        console.log('[Popup] Skipping restore - location export errored:', state.message);
        // Clear the error state
        chrome.storage.local.set({ locationExportState: { isExporting: false, progress: 0, message: '' } });
        return;
      }
      // Only restore if the export started within the last 10 minutes
      if (Date.now() - state.timestamp < 10 * 60 * 1000) {
        console.log('[Popup] Restoring location export progress:', state);
        isExportRunning = true;
        exportOverlay.classList.add('active');
        exportOverlayType.textContent = 'Exporting location assets...';
        updateExportOverlay(state.progress, state.message || 'Export in progress...');
      } else {
        // Export state is stale (over 10 minutes old), clear it
        console.log('[Popup] Clearing stale location export state');
        chrome.storage.local.set({ locationExportState: { isExporting: false, progress: 0, message: '' } });
      }
    }
  } catch (error) {
    console.error('[Popup] Error restoring export progress:', error);
  }
}

// Restore progress state on popup open
restoreExportProgress();

/**
 * License Management Functions
 */

// Check stored license on popup open
async function initializeLicense() {
  try {
    const result = await window.licenseManager.checkStoredLicense();
    if (result.valid) {
      showLicenseActive(result);
    } else {
      showLicenseInput();
    }
  } catch (error) {
    console.error('[Popup] License init error:', error);
    showLicenseInput();
  }
}

// Show license as active
function showLicenseActive(result) {
  isLicenseValid = true;
  licenseStatusContainer.style.display = 'block';
  licenseInputContainer.style.display = 'none';

  const usageText = result.remainingUses === 'unlimited'
    ? `${result.usageCount || 0} exports used`
    : `${result.usageCount || 0} / ${result.license.max_uses} exports used`;
  licenseUsageInfo.textContent = usageText;

  // Enable export buttons
  exportManualButton.disabled = false;
  exportSelectedButton.disabled = false;
  exportLocationButton.disabled = false;
}

// Show license input form
function showLicenseInput() {
  isLicenseValid = false;
  licenseStatusContainer.style.display = 'none';
  licenseInputContainer.style.display = 'block';

  // Disable export buttons until license is activated
  exportManualButton.disabled = true;
  exportSelectedButton.disabled = true;
  exportLocationButton.disabled = true;
}

// Show license message
function showLicenseMessage(text, type) {
  licenseMessage.textContent = text;
  licenseMessage.className = `message ${type}`;
  licenseMessage.style.display = 'block';
}

// Activate license button handler
activateLicenseBtn.addEventListener('click', async () => {
  const code = licenseCodeInput.value.trim();
  if (!code) {
    showLicenseMessage('Please enter a license code', 'error');
    return;
  }

  activateLicenseBtn.disabled = true;
  activateLicenseBtn.innerHTML = '<span>⏳</span><span>Validating...</span>';

  try {
    const result = await window.licenseManager.validateLicense(code);

    if (result.valid) {
      await window.licenseManager.storeLicense(code);
      showLicenseActive(result);
      licenseMessage.style.display = 'none';
    } else {
      showLicenseMessage(result.error || 'Invalid license code', 'error');
    }
  } catch (error) {
    showLicenseMessage('Failed to validate license: ' + error.message, 'error');
  } finally {
    activateLicenseBtn.disabled = false;
    activateLicenseBtn.innerHTML = '<span>🔑</span><span>Activate License</span>';
  }
});

// Deactivate license button handler
deactivateLicenseBtn.addEventListener('click', async () => {
  await window.licenseManager.clearLicense();
  licenseCodeInput.value = '';
  showLicenseInput();
});

// Initialize license on popup load
initializeLicense();

/**
 * Update asset count badge
 */
function updateAssetCountBadge() {
  const allCheckboxes = document.querySelectorAll('.asset-checkbox-item input[type="checkbox"]');
  const checkedCheckboxes = document.querySelectorAll('.asset-checkbox-item input[type="checkbox"]:checked');
  const badge = document.getElementById('assetCountBadge');

  if (badge) {
    if (checkedCheckboxes.length === allCheckboxes.length) {
      badge.textContent = 'All';
    } else if (checkedCheckboxes.length === 0) {
      badge.textContent = 'None';
    } else {
      badge.textContent = `${checkedCheckboxes.length}/${allCheckboxes.length}`;
    }
  }
}

/**
 * Select all asset checkboxes
 */
selectAllAssetsButton.addEventListener('click', () => {
  const checkboxes = document.querySelectorAll('.asset-checkbox-item input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.checked = true;
  });
  updateAssetCountBadge();
});

/**
 * Deselect all asset checkboxes
 */
deselectAllAssetsButton.addEventListener('click', () => {
  const checkboxes = document.querySelectorAll('.asset-checkbox-item input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
  updateAssetCountBadge();
});

/**
 * Listen for individual checkbox changes
 */
document.querySelectorAll('.asset-checkbox-item input[type="checkbox"]').forEach(checkbox => {
  checkbox.addEventListener('change', updateAssetCountBadge);
});

/**
 * Get selected asset types
 */
function getSelectedAssets() {
  const checkboxes = document.querySelectorAll('.asset-checkbox-item input[type="checkbox"]:checked');
  const selectedAssets = Array.from(checkboxes).map(checkbox => checkbox.value);
  return selectedAssets.length > 0 ? selectedAssets : null;
}

/**
 * Export with manual IDs
 */
exportManualButton.addEventListener('click', async () => {
  try {
    // Check if export is already running
    if (!canStartExport()) {
      return;
    }

    // Check license first
    if (!isLicenseValid) {
      showMessage('Please activate a valid license to export', 'error');
      return;
    }

    const snapshotId = snapshotIdInput.value.trim();
    const companyId = companyIdInput.value.trim();

    if (!snapshotId || !companyId) {
      showMessage('Please enter both Snapshot ID and Company ID', 'error');
      return;
    }

    // Validate and record license usage
    const licenseCode = await window.licenseManager.getStoredLicense();
    const usageResult = await window.licenseManager.recordUsage(licenseCode, {
      snapshotId,
      companyId
    });

    if (!usageResult.success) {
      showMessage(usageResult.error || 'License validation failed', 'error');
      // Re-check license status
      initializeLicense();
      return;
    }

    // Disable button and show overlay
    exportManualButton.disabled = true;
    showExportOverlay('snapshot');

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

    // Check if on GHL page by querying the content script
    const ghlCheck = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'checkGHLPage' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('[Popup] GHL check error:', chrome.runtime.lastError);
          resolve({ isGHLPage: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response || { isGHLPage: false });
        }
      });
    });

    console.log('[Popup] GHL page check result:', ghlCheck);

    if (!ghlCheck.isGHLPage) {
      showMessage(
        'This does not appear to be a GoHighLevel page. The extension needs to run on a GHL page (including white-labeled domains) to access authentication.',
        'error'
      );
      resetUI();
      return;
    }

    // Get export format
    const format = exportFormatSelect ? exportFormatSelect.value : 'xlsx';

    // Get selected assets
    const selectedAssets = getSelectedAssets();
    if (!selectedAssets) {
      showMessage('Please select at least one asset type to export', 'error');
      exportManualButton.disabled = false;
      return;
    }

    console.log('[Popup] Sending export request with IDs:', { snapshotId, companyId, format, selectedAssets });

    // Send export request with IDs
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'exportSnapshotWithIds',
      snapshotId: snapshotId,
      companyId: companyId,
      format: format,
      selectedAssets: selectedAssets
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
    // Update both old progress bar and new overlay
    progressText.textContent = request.message;
    progressBar.style.width = request.progress + '%';
    updateExportOverlay(request.progress, request.message);

    // If complete, show success message and hide overlay
    if (request.progress >= 100) {
      // Clear storage state immediately
      chrome.storage.local.set({ snapshotExportState: { isExporting: false, progress: 0, message: '' } });
      setTimeout(() => {
        hideExportOverlay();
        showMessage('Export completed successfully! Check your downloads folder.', 'success');
        resetUI();
      }, 500);
    }
    // If error (progress reset to 0 with error message), hide overlay and show error
    else if (request.progress === 0 && request.message && request.message.startsWith('Error:')) {
      chrome.storage.local.set({ snapshotExportState: { isExporting: false, progress: 0, message: '' } });
      setTimeout(() => {
        hideExportOverlay();
        showMessage(request.message, 'error');
        resetUI();
      }, 500);
    }
  }

  if (request.action === 'locationExportProgress') {
    // Update both old progress bar and new overlay
    locationProgressText.textContent = request.message;
    locationProgressBar.style.width = request.progress + '%';
    updateExportOverlay(request.progress, request.message);

    // If complete, show success message and hide overlay
    if (request.progress >= 100) {
      // Clear storage state immediately
      chrome.storage.local.set({ locationExportState: { isExporting: false, progress: 0, message: '' } });
      setTimeout(() => {
        hideExportOverlay();
        showLocationMessage('Export completed successfully! Check your downloads folder.', 'success');
        resetLocationUI();
      }, 500);
    }
    // If error (progress reset to 0 with error message), hide overlay and show error
    else if (request.progress === 0 && request.message && request.message.startsWith('Error:')) {
      chrome.storage.local.set({ locationExportState: { isExporting: false, progress: 0, message: '' } });
      setTimeout(() => {
        hideExportOverlay();
        showLocationMessage(request.message, 'error');
        resetLocationUI();
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
    // Check if export is already running
    if (!canStartExport()) {
      return;
    }

    // Check license first
    if (!isLicenseValid) {
      showMessage('Please activate a valid license to export', 'error');
      return;
    }

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

    // Get selected assets
    const selectedAssets = getSelectedAssets();
    if (!selectedAssets) {
      showMessage('Please select at least one asset type to export', 'error');
      return;
    }

    // Validate and record license usage
    const licenseCode = await window.licenseManager.getStoredLicense();
    const usageResult = await window.licenseManager.recordUsage(licenseCode, {
      snapshotId,
      companyId
    });

    if (!usageResult.success) {
      showMessage(usageResult.error || 'License validation failed', 'error');
      // Re-check license status
      initializeLicense();
      return;
    }

    console.log('[Popup] Exporting selected snapshot:', snapshotId, 'format:', format, 'assets:', selectedAssets);

    // Disable button and show overlay
    exportSelectedButton.disabled = true;
    showExportOverlay('snapshot');

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
      format: format,
      selectedAssets: selectedAssets
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
 * Export location assets (without snapshot)
 */
exportLocationButton.addEventListener('click', async () => {
  try {
    // Check if export is already running
    if (!canStartExport()) {
      return;
    }

    // Check license first
    if (!isLicenseValid) {
      showLocationMessage('Please activate a valid license to export', 'error');
      return;
    }

    const locationId = currentLocationIdInput.value.trim();
    if (!locationId) {
      showLocationMessage('Location ID not detected. Please ensure you are on a GHL page.', 'error');
      return;
    }

    // Get selected assets
    const selectedAssets = getSelectedAssets();
    if (!selectedAssets) {
      showLocationMessage('Please select at least one asset type to export', 'error');
      return;
    }

    // Get export format
    const format = exportFormatSelect ? exportFormatSelect.value : 'xlsx';

    // Validate and record license usage
    const licenseCode = await window.licenseManager.getStoredLicense();
    const usageResult = await window.licenseManager.recordUsage(licenseCode, {
      locationId,
      exportType: 'location_assets'
    });

    if (!usageResult.success) {
      showLocationMessage(usageResult.error || 'License validation failed', 'error');
      initializeLicense();
      return;
    }

    console.log('[Popup] Exporting location assets:', locationId, 'format:', format, 'assets:', selectedAssets);

    // Disable button and show overlay
    exportLocationButton.disabled = true;
    showExportOverlay('location');

    // Show progress
    locationProgress.style.display = 'block';
    locationMessageDiv.style.display = 'none';
    locationProgressBar.style.width = '0%';
    locationProgressText.textContent = 'Preparing export...';

    // Get active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) {
      throw new Error('No active tab found');
    }

    // Send export request
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'exportLocationAssets',
      locationId: locationId,
      format: format,
      selectedAssets: selectedAssets
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Popup] Location export error:', chrome.runtime.lastError);
        showLocationMessage('Unable to export. Please refresh the GHL page and try again.', 'error');
        resetLocationUI();
        return;
      }

      if (!response || !response.success) {
        showLocationMessage(response?.error || 'Export failed', 'error');
        resetLocationUI();
        return;
      }
    });

  } catch (error) {
    console.error('[Popup] Location export error:', error);
    showLocationMessage(error.message, 'error');
    resetLocationUI();
  }
});

/**
 * Show location message
 */
function showLocationMessage(text, type) {
  locationMessageDiv.textContent = text;
  locationMessageDiv.className = `message ${type}`;
  locationMessageDiv.style.display = 'block';
}

/**
 * Reset location export UI
 */
function resetLocationUI() {
  exportLocationButton.disabled = false;
  hideExportOverlay();
  setTimeout(() => {
    locationProgress.style.display = 'none';
    locationProgressBar.style.width = '0%';
  }, 2000);
}

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
  hideExportOverlay();

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

  // Check if on GHL page by querying the content script
  snapshotSelect.innerHTML = '<option value="">Detecting GHL page...</option>';

  chrome.tabs.sendMessage(tabs[0].id, { action: 'checkGHLPage' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[Popup] GHL check error:', chrome.runtime.lastError);
      snapshotSelect.innerHTML = '<option value="">Extension not loaded. Please refresh the page.</option>';
      return;
    }

    console.log('[Popup] GHL page check result:', response);

    if (!response || !response.isGHLPage) {
      console.warn('[Popup] Not on a GHL page');
      snapshotSelect.innerHTML = '<option value="">Not a GHL page (check white-label detection)</option>';
      currentLocationIdInput.value = '';
      currentLocationIdInput.placeholder = 'Not detected';
      return;
    }

    // Set the location ID if available
    if (response.locationId) {
      currentLocationIdInput.value = response.locationId;
      console.log('[Popup] Location ID set:', response.locationId);
    }

    console.log('[Popup] GHL page detected, fetching snapshots...');

    // Fetch snapshots without companyId - content script will get it from user endpoint
    fetchSnapshotsList(null);
  });
});
