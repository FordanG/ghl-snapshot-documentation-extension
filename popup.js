/**
 * GHL Snapshot Export - Popup UI Controller (v1)
 */

// ==================== Tab Navigation ====================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// "Activate" button on compact license bar -> switch to settings tab
document.getElementById('goToSettingsBtn').addEventListener('click', () => {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('.tab-btn[data-tab="settings"]').classList.add('active');
  document.getElementById('tab-settings').classList.add('active');
});

// ==================== DOM Elements ====================
const exportFormatSelect = document.getElementById('exportFormat');
const openaiKeyInput = document.getElementById('openaiKey');
const enableAICheckbox = document.getElementById('enableAI');
const selectAllAssetsButton = document.getElementById('selectAllAssets');
const deselectAllAssetsButton = document.getElementById('deselectAllAssets');

const exportLocationButton = document.getElementById('exportLocationButton');
const currentLocationIdInput = document.getElementById('currentLocationId');
const locationProgress = document.getElementById('locationProgress');
const locationProgressText = document.getElementById('locationProgressText');
const locationProgressBar = document.getElementById('locationProgressBar');
const locationMessageDiv = document.getElementById('locationMessage');

const licenseCodeInput = document.getElementById('licenseCode');
const activateLicenseBtn = document.getElementById('activateLicenseBtn');
const deactivateLicenseBtn = document.getElementById('deactivateLicenseBtn');
const licenseStatusContainer = document.getElementById('licenseStatusContainer');
const licenseInputContainer = document.getElementById('licenseInputContainer');
const licenseUsageInfo = document.getElementById('licenseUsageInfo');
const licenseMessage = document.getElementById('licenseMessage');

const licenseCompact = document.getElementById('licenseCompact');
const licenseCompactText = document.getElementById('licenseCompactText');
const goToSettingsBtn = document.getElementById('goToSettingsBtn');

const openaiKeyInputContainer = document.getElementById('openaiKeyInputContainer');
const openaiKeySavedContainer = document.getElementById('openaiKeySavedContainer');
const openaiKeyMasked = document.getElementById('openaiKeyMasked');
const testOpenaiKeyBtn = document.getElementById('testOpenaiKey');
const changeOpenaiKeyBtn = document.getElementById('changeOpenaiKey');
const openaiKeyStatus = document.getElementById('openaiKeyStatus');
const includeFullEnrichmentCheckbox = document.getElementById('includeFullEnrichment');
const aiFriendlyModeCheckbox = document.getElementById('aiFriendlyMode');

const exportOverlay = document.getElementById('exportOverlay');
const exportOverlayType = document.getElementById('exportOverlayType');
const exportOverlayStatus = document.getElementById('exportOverlayStatus');
const exportOverlayBar = document.getElementById('exportOverlayBar');
const exportOverlayPercent = document.getElementById('exportOverlayPercent');
const dismissOverlayBtn = document.getElementById('dismissOverlayBtn');

let isLicenseValid = false;
let isExportRunning = false;

// ==================== Settings: Load & Save ====================
chrome.storage.local.get(['openaiApiKey', 'aiAnalysisEnabled', 'includeFullEnrichment', 'aiFriendlyMode'], (result) => {
  if (result.openaiApiKey) {
    showSavedKeyUI(result.openaiApiKey);
  } else {
    showKeyInputUI();
  }
  enableAICheckbox.checked = result.aiAnalysisEnabled === true;
  includeFullEnrichmentCheckbox.checked = result.includeFullEnrichment !== false;
  aiFriendlyModeCheckbox.checked = result.aiFriendlyMode === true;
});

function showSavedKeyUI(key) {
  openaiKeyInputContainer.style.display = 'none';
  openaiKeySavedContainer.style.display = 'block';
  openaiKeyStatus.style.display = 'none';
  const maskedKey = key.substring(0, 7) + '...' + key.substring(key.length - 4);
  openaiKeyMasked.textContent = 'API Key: ' + maskedKey;
}

function showKeyInputUI() {
  openaiKeyInputContainer.style.display = 'flex';
  openaiKeySavedContainer.style.display = 'none';
  openaiKeyInput.value = '';
}

changeOpenaiKeyBtn.addEventListener('click', () => {
  chrome.storage.local.get(['openaiApiKey'], (result) => {
    showKeyInputUI();
    if (result.openaiApiKey) {
      openaiKeyInput.value = result.openaiApiKey;
    }
  });
});

testOpenaiKeyBtn.addEventListener('click', async () => {
  const key = openaiKeyInput.value.trim();
  if (!key) { showKeyStatus('Please enter an API key first', 'error'); return; }
  if (!key.startsWith('sk-')) { showKeyStatus('Invalid key format - should start with sk-', 'error'); return; }

  testOpenaiKeyBtn.disabled = true;
  testOpenaiKeyBtn.textContent = 'Testing...';
  showKeyStatus('Testing connection...', 'info');

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + key }
    });
    if (response.ok) {
      showKeyStatus('API key is valid and working!', 'success');
      chrome.storage.local.set({ openaiApiKey: key }, () => {
        setTimeout(() => { showSavedKeyUI(key); }, 1500);
      });
    } else {
      const error = await response.json().catch(() => ({}));
      showKeyStatus('Invalid key: ' + (error.error?.message || response.statusText), 'error');
    }
  } catch (error) {
    showKeyStatus('Connection error: ' + error.message, 'error');
  } finally {
    testOpenaiKeyBtn.disabled = false;
    testOpenaiKeyBtn.textContent = 'Test';
  }
});

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

enableAICheckbox.addEventListener('change', () => {
  chrome.storage.local.set({ aiAnalysisEnabled: enableAICheckbox.checked });
});

includeFullEnrichmentCheckbox.addEventListener('change', () => {
  chrome.storage.local.set({ includeFullEnrichment: includeFullEnrichmentCheckbox.checked });
});

aiFriendlyModeCheckbox.addEventListener('change', () => {
  chrome.storage.local.set({ aiFriendlyMode: aiFriendlyModeCheckbox.checked });
});

// ==================== Export Overlay ====================
function showExportOverlay() {
  isExportRunning = true;
  exportOverlay.classList.add('active');
  exportOverlayType.textContent = 'Exporting location assets...';
  exportOverlayStatus.textContent = 'Preparing export...';
  exportOverlayBar.style.width = '0%';
  exportOverlayPercent.textContent = '0%';
  startExportMonitor();
}

function updateExportOverlay(progress, message) {
  exportOverlayStatus.textContent = message;
  exportOverlayBar.style.width = progress + '%';
  exportOverlayPercent.textContent = Math.round(progress) + '%';
}

function hideExportOverlay() {
  isExportRunning = false;
  exportOverlay.classList.remove('active');
  stopExportMonitor();
}

dismissOverlayBtn.addEventListener('click', () => {
  hideExportOverlay();
  chrome.storage.local.set({ locationExportState: { isExporting: false, progress: 0, message: '' } });
  exportLocationButton.disabled = false;
});

function canStartExport() {
  if (isExportRunning) {
    alert('An export is already in progress. Please wait for it to complete.');
    return false;
  }
  return true;
}

async function restoreExportProgress() {
  try {
    const result = await chrome.storage.local.get(['locationExportState']);
    if (result.locationExportState && result.locationExportState.isExporting) {
      const state = result.locationExportState;
      if (state.progress === 0 && state.message && state.message.startsWith('Error:')) {
        chrome.storage.local.set({ locationExportState: { isExporting: false, progress: 0, message: '' } });
        return;
      }
      if (Date.now() - state.timestamp < 10 * 60 * 1000) {
        isExportRunning = true;
        exportOverlay.classList.add('active');
        exportOverlayType.textContent = 'Exporting location assets...';
        updateExportOverlay(state.progress, state.message || 'Export in progress...');
        startExportMonitor();
      } else {
        chrome.storage.local.set({ locationExportState: { isExporting: false, progress: 0, message: '' } });
      }
    }
  } catch (_) { /* ignore */ }
}

restoreExportProgress();

// ==================== License Management ====================
function updateCompactLicense(valid, text) {
  licenseCompact.className = 'license-compact ' + (valid ? 'valid' : 'invalid');
  licenseCompact.style.display = 'flex';
  licenseCompactText.textContent = text;
  goToSettingsBtn.textContent = valid ? 'Manage' : 'Activate';
}

async function initializeLicense() {
  try {
    const result = await window.licenseManager.checkStoredLicense();
    if (result.valid) {
      showLicenseActive(result);
    } else {
      showLicenseInput();
    }
  } catch (_) {
    showLicenseInput();
  }
}

function showLicenseActive(result) {
  isLicenseValid = true;
  licenseStatusContainer.style.display = 'block';
  licenseInputContainer.style.display = 'none';

  const usageText = result.remainingUses === 'unlimited'
    ? (result.usageCount || 0) + ' exports used'
    : (result.usageCount || 0) + ' / ' + result.license.max_uses + ' exports used';
  licenseUsageInfo.textContent = usageText;

  exportLocationButton.disabled = false;
  updateCompactLicense(true, 'Licensed - ' + usageText);
}

function showLicenseInput() {
  isLicenseValid = false;
  licenseStatusContainer.style.display = 'none';
  licenseInputContainer.style.display = 'block';
  exportLocationButton.disabled = true;
  updateCompactLicense(false, 'License required to export');
}

function showLicenseMessage(text, type) {
  licenseMessage.textContent = text;
  licenseMessage.className = 'message ' + type;
  licenseMessage.style.display = 'block';
}

activateLicenseBtn.addEventListener('click', async () => {
  const code = licenseCodeInput.value.trim();
  if (!code) { showLicenseMessage('Please enter a license code', 'error'); return; }

  activateLicenseBtn.disabled = true;
  activateLicenseBtn.innerHTML = '<span>Validating...</span>';

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
    activateLicenseBtn.innerHTML = '<span>Activate License</span>';
  }
});

deactivateLicenseBtn.addEventListener('click', async () => {
  await window.licenseManager.clearLicense();
  licenseCodeInput.value = '';
  showLicenseInput();
});

initializeLicense();

// ==================== Asset Selection ====================
function updateAssetCountBadge() {
  const all = document.querySelectorAll('.asset-checkbox-item input[type="checkbox"]');
  const checked = document.querySelectorAll('.asset-checkbox-item input[type="checkbox"]:checked');
  const badge = document.getElementById('assetCountBadge');
  if (badge) {
    if (checked.length === all.length) badge.textContent = 'All';
    else if (checked.length === 0) badge.textContent = 'None';
    else badge.textContent = checked.length + '/' + all.length;
  }
}

selectAllAssetsButton.addEventListener('click', () => {
  document.querySelectorAll('.asset-checkbox-item input[type="checkbox"]').forEach(cb => cb.checked = true);
  updateAssetCountBadge();
});

deselectAllAssetsButton.addEventListener('click', () => {
  document.querySelectorAll('.asset-checkbox-item input[type="checkbox"]').forEach(cb => cb.checked = false);
  updateAssetCountBadge();
});

document.querySelectorAll('.asset-checkbox-item input[type="checkbox"]').forEach(cb => {
  cb.addEventListener('change', updateAssetCountBadge);
});

// Asset type search filter
const assetSearchInput = document.getElementById('assetSearch');
if (assetSearchInput) {
  assetSearchInput.addEventListener('input', () => {
    const query = assetSearchInput.value.toLowerCase();
    document.querySelectorAll('.asset-checkbox-item').forEach(item => {
      const label = item.querySelector('label');
      const text = label ? label.textContent.toLowerCase() : '';
      item.style.display = text.includes(query) ? '' : 'none';
    });
  });
}

function getSelectedAssets() {
  const checkboxes = document.querySelectorAll('.asset-checkbox-item input[type="checkbox"]:checked');
  const selected = Array.from(checkboxes).map(cb => cb.value);
  return selected.length > 0 ? selected : null;
}

// ==================== Export ====================
exportLocationButton.addEventListener('click', async () => {
  try {
    if (!canStartExport()) return;

    if (!isLicenseValid) {
      showLocationMessage('Please activate a valid license to export', 'error');
      return;
    }

    const locationId = currentLocationIdInput.value.trim();
    if (!locationId) {
      showLocationMessage('Location ID not detected. Please ensure you are on a GHL page.', 'error');
      return;
    }

    const selectedAssets = getSelectedAssets();
    if (!selectedAssets) {
      showLocationMessage('Please select at least one asset type to export', 'error');
      return;
    }

    const format = exportFormatSelect ? exportFormatSelect.value : 'xlsx+html';

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

    exportLocationButton.disabled = true;
    showExportOverlay();

    locationProgress.style.display = 'block';
    locationMessageDiv.style.display = 'none';
    locationProgressBar.style.width = '0%';
    locationProgressText.textContent = 'Preparing export...';

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) throw new Error('No active tab found');

    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'exportLocationAssets',
      locationId: locationId,
      format: format,
      selectedAssets: selectedAssets
    }, (response) => {
      if (chrome.runtime.lastError) {
        showLocationMessage('Unable to export. Please refresh the GHL page and try again.', 'error');
        resetLocationUI();
        return;
      }
      if (!response || !response.success) {
        showLocationMessage(response?.error || 'Export failed', 'error');
        resetLocationUI();
      }
    });

  } catch (error) {
    showLocationMessage(error.message, 'error');
    resetLocationUI();
  }
});

function showLocationMessage(text, type) {
  locationMessageDiv.textContent = text;
  locationMessageDiv.className = 'message ' + type;
  locationMessageDiv.style.display = 'block';
}

function resetLocationUI() {
  exportLocationButton.disabled = false;
  hideExportOverlay();
  setTimeout(() => {
    locationProgress.style.display = 'none';
    locationProgressBar.style.width = '0%';
  }, 2000);
}

function handleExportComplete(message) {
  chrome.storage.local.set({ locationExportState: { isExporting: false, progress: 0, message: '' } });
  hideExportOverlay();
  showLocationMessage(message, 'success');
  resetLocationUI();
}

function handleExportError(message) {
  chrome.storage.local.set({ locationExportState: { isExporting: false, progress: 0, message: '' } });
  hideExportOverlay();
  showLocationMessage(message, 'error');
  resetLocationUI();
}

// ==================== Progress Listener ====================
chrome.runtime.onMessage.addListener((request) => {
  try {
    if (request.action === 'locationExportProgress') {
      if (locationProgressText) locationProgressText.textContent = request.message;
      if (locationProgressBar) locationProgressBar.style.width = request.progress + '%';
      updateExportOverlay(request.progress, request.message);

      if (request.progress >= 100) {
        handleExportComplete('Export completed successfully! Check your downloads folder.');
      } else if (request.progress === 0 && request.message && request.message.startsWith('Error:')) {
        handleExportError(request.message);
      }
    }
  } catch (_) { /* ignore */ }
});

// ==================== Export Monitor ====================
let exportCheckInterval = null;

function startExportMonitor() {
  if (exportCheckInterval) return;
  exportCheckInterval = setInterval(async () => {
    if (!isExportRunning) { stopExportMonitor(); return; }
    try {
      const result = await chrome.storage.local.get(['locationExportState']);
      if (result.locationExportState) {
        const state = result.locationExportState;
        if (!state.isExporting && isExportRunning) {
          if (state.progress >= 100 || state.message === 'Export complete!') {
            handleExportComplete('Export completed successfully! Check your downloads folder.');
          } else if (state.message && state.message.startsWith('Error:')) {
            handleExportError(state.message);
          } else {
            hideExportOverlay();
            resetLocationUI();
          }
          stopExportMonitor();
        }
      }
    } catch (_) { /* ignore */ }
  }, 1000);
}

function stopExportMonitor() {
  if (exportCheckInterval) {
    clearInterval(exportCheckInterval);
    exportCheckInterval = null;
  }
}

// ==================== Auto-detect Location ====================
chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  if (!tabs[0]) return;

  chrome.tabs.sendMessage(tabs[0].id, { action: 'checkGHLPage' }, (response) => {
    if (chrome.runtime.lastError) {
      currentLocationIdInput.value = '';
      currentLocationIdInput.placeholder = 'Extension not loaded. Please refresh the page.';
      return;
    }
    if (!response || !response.isGHLPage) {
      currentLocationIdInput.value = '';
      currentLocationIdInput.placeholder = 'Not a GHL page';
      return;
    }
    if (response.locationId) {
      currentLocationIdInput.value = response.locationId;
    }
  });
});
