/**
 * GHL Snapshot Export - Background Service Worker
 */

console.log('[Background] GHL Snapshot Export extension loaded');

// Listen for extension installation or updates
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Background] Extension installed');
  } else if (details.reason === 'update') {
    console.log('[Background] Extension updated to version', chrome.runtime.getManifest().version);
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Message received:', request);

  // Forward progress updates to popup and persist to storage
  if (request.action === 'snapshotExportProgress') {
    // Store progress in chrome.storage so popup can restore it
    const isComplete = request.progress >= 100;
    const isError = request.progress === 0 && request.message && request.message.startsWith('Error:');
    chrome.storage.local.set({
      snapshotExportState: {
        isExporting: !isComplete && !isError,
        progress: request.progress,
        message: request.message,
        timestamp: Date.now()
      }
    });

    // Clear export state after completion or error (with small delay)
    if (isComplete || isError) {
      setTimeout(() => {
        chrome.storage.local.set({
          snapshotExportState: { isExporting: false, progress: 0, message: '' }
        });
      }, 3000);
    }

    // Broadcast to all extension views (popup)
    chrome.runtime.sendMessage(request).catch(() => {
      // Popup might be closed, that's ok - state is persisted
    });
  }

  // Forward location export progress and persist to storage
  if (request.action === 'locationExportProgress') {
    const isComplete = request.progress >= 100;
    const isError = request.progress === 0 && request.message && request.message.startsWith('Error:');
    chrome.storage.local.set({
      locationExportState: {
        isExporting: !isComplete && !isError,
        progress: request.progress,
        message: request.message,
        timestamp: Date.now()
      }
    });

    // Clear export state after completion or error (with small delay)
    if (isComplete || isError) {
      setTimeout(() => {
        chrome.storage.local.set({
          locationExportState: { isExporting: false, progress: 0, message: '' }
        });
      }, 3000);
    }

    // Broadcast to all extension views (popup)
    chrome.runtime.sendMessage(request).catch(() => {
      // Popup might be closed, that's ok - state is persisted
    });
  }

  return false;
});
