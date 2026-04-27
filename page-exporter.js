/**
 * Page Context Wrapper for Snapshot Exporter
 *
 * This script runs in the PAGE context (not content script context)
 * so it can be accessed from the browser console.
 *
 * It provides convenience functions that send messages to the content script.
 */

// Expose snapshot export functions to the page context
window.ghlSnapshotExporter = {
  /**
   * Export snapshot with provided IDs
   */
  async exportSnapshotWithIds(snapshotId, companyId) {
    const event = new CustomEvent('ghl-snapshot-export', {
      detail: {
        action: 'exportSnapshotWithIds',
        snapshotId,
        companyId
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
        reject(new Error('Export timeout - took longer than 5 minutes'));
      }, 300000);
    });
  },

  /**
   * Export current snapshot (auto-detect from URL)
   */
  async exportCurrentSnapshot() {
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
    const url = window.location.href;
    const snapshotMatch = url.match(/\/snapshot\/([^\/\?]+)/);
    const companyMatch = url.match(/[?&]companyId=([^&]+)/);

    const info = {
      snapshotId: snapshotMatch ? snapshotMatch[1] : null,
      companyId: companyMatch ? companyMatch[1] : null
    };

    if (!info.companyId && window.ghlUtilsRevex) {
      try {
        info.companyId = await window.ghlUtilsRevex.getLocationId();
      } catch (e) {}
    }

    return info;
  }
};
