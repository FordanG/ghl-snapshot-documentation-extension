/**
 * Page Context Wrapper for Snapshot Exporter
 *
 * This script runs in the PAGE context (not content script context)
 * so it can be accessed from the browser console.
 *
 * It provides convenience functions that send messages to the content script.
 */

console.log('[Page Exporter] Loading page context wrapper...');

// Expose snapshot export functions to the page context
window.ghlSnapshotExporter = {
  /**
   * Export snapshot with provided IDs
   */
  async exportSnapshotWithIds(snapshotId, companyId) {
    console.log('[Page Exporter] Sending export request to content script');

    // Send message to content script via custom event
    const event = new CustomEvent('ghl-snapshot-export', {
      detail: {
        action: 'exportSnapshotWithIds',
        snapshotId,
        companyId
      }
    });

    document.dispatchEvent(event);

    return new Promise((resolve, reject) => {
      // Listen for response
      const responseHandler = (e) => {
        if (e.detail.action === 'exportComplete') {
          document.removeEventListener('ghl-snapshot-export-response', responseHandler);
          resolve(e.detail.result);
        } else if (e.detail.action === 'exportError') {
          document.removeEventListener('ghl-snapshot-export-response', responseHandler);
          reject(new Error(e.detail.error));
        }
      };

      document.addEventListener('ghl-snapshot-export-response', responseHandler);

      // Timeout after 5 minutes
      setTimeout(() => {
        document.removeEventListener('ghl-snapshot-export-response', responseHandler);
        reject(new Error('Export timeout - took longer than 5 minutes'));
      }, 300000);
    });
  },

  /**
   * Export current snapshot (auto-detect from URL)
   */
  async exportCurrentSnapshot() {
    console.log('[Page Exporter] Exporting current snapshot');

    const event = new CustomEvent('ghl-snapshot-export', {
      detail: {
        action: 'exportCurrentSnapshot'
      }
    });

    document.dispatchEvent(event);

    return new Promise((resolve, reject) => {
      const responseHandler = (e) => {
        if (e.detail.action === 'exportComplete') {
          document.removeEventListener('ghl-snapshot-export-response', responseHandler);
          resolve(e.detail.result);
        } else if (e.detail.action === 'exportError') {
          document.removeEventListener('ghl-snapshot-export-response', responseHandler);
          reject(new Error(e.detail.error));
        }
      };

      document.addEventListener('ghl-snapshot-export-response', responseHandler);

      setTimeout(() => {
        document.removeEventListener('ghl-snapshot-export-response', responseHandler);
        reject(new Error('Export timeout'));
      }, 300000);
    });
  },

  /**
   * Get current snapshot info
   */
  async getCurrentSnapshotInfo() {
    // Try to get from URL
    const url = window.location.href;
    const snapshotMatch = url.match(/\/snapshot\/([^\/\?]+)/);
    const companyMatch = url.match(/[?&]companyId=([^&]+)/);

    const info = {
      snapshotId: snapshotMatch ? snapshotMatch[1] : null,
      companyId: companyMatch ? companyMatch[1] : null
    };

    // Try to get company ID from Revex if available
    if (!info.companyId && window.ghlUtilsRevex) {
      try {
        info.companyId = await window.ghlUtilsRevex.getLocationId();
      } catch (e) {
        console.warn('[Page Exporter] Could not get company ID from Revex:', e);
      }
    }

    return info;
  }
};

console.log('[Page Exporter] Functions exposed on window.ghlSnapshotExporter');
console.log('[Page Exporter] Available methods:', Object.keys(window.ghlSnapshotExporter));
