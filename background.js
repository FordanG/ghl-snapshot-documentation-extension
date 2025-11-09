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

  // Forward progress updates to popup
  if (request.action === 'snapshotExportProgress') {
    // Broadcast to all extension views (popup)
    chrome.runtime.sendMessage(request);
  }

  return false;
});
