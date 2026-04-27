/**
 * License Manager for Super Snapshots AI
 * Handles license validation and usage tracking via Supabase Edge Function
 */

const LICENSE_CONFIG = {
  EDGE_FUNCTION_URL: 'https://aggtrjiseqoeottcrbuw.supabase.co/functions/v1/verify-license'
};

/**
 * License Manager Class
 */
class LicenseManager {
  constructor() {
    this.edgeFunctionUrl = LICENSE_CONFIG.EDGE_FUNCTION_URL;
    this.cachedLicense = null;
  }

  /**
   * Call the edge function for license operations
   */
  async callEdgeFunction(payload) {
    const response = await fetch(this.edgeFunctionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok && !data.error) {
      throw new Error(`Edge function error: ${response.statusText}`);
    }
    return data;
  }

  /**
   * Validate a license code
   * @param {string} licenseCode - The license code to validate
   * @returns {Promise<{valid: boolean, license?: object, error?: string, usageCount?: number}>}
   */
  async validateLicense(licenseCode) {
    try {
      if (!licenseCode || licenseCode.trim() === '') {
        return { valid: false, error: 'License code is required' };
      }

      const code = licenseCode.trim().toUpperCase();
      const result = await this.callEdgeFunction({ action: 'validate', licenseCode: code });

      if (result.valid) {
        this.cachedLicense = { license_code: code };
      }

      return result;
    } catch (error) {
      return { valid: false, error: 'Failed to validate license: ' + error.message };
    }
  }

  /**
   * Record a license usage
   * @param {string} licenseCode - The license code
   * @param {object} metadata - Additional metadata (snapshotId, companyId, etc.)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async recordUsage(licenseCode, metadata = {}) {
    try {
      const code = licenseCode.trim().toUpperCase();
      const result = await this.callEdgeFunction({
        action: 'record_usage',
        licenseCode: code,
        metadata: {
          snapshotId: metadata.snapshotId || null,
          companyId: metadata.companyId || null,
          userAgent: navigator.userAgent || null
        }
      });

      if (!result.valid && !result.success) {
        return { success: false, error: result.error };
      }

      return { success: true, usageCount: result.usageCount };
    } catch (error) {
      return { success: false, error: 'Failed to record usage: ' + error.message };
    }
  }

  /**
   * Get stored license from chrome storage
   * @returns {Promise<string|null>}
   */
  async getStoredLicense() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['licenseCode'], (result) => {
        resolve(result.licenseCode || null);
      });
    });
  }

  /**
   * Store license in chrome storage
   * @param {string} licenseCode
   * @returns {Promise<void>}
   */
  async storeLicense(licenseCode) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ licenseCode: licenseCode.trim().toUpperCase() }, resolve);
    });
  }

  /**
   * Clear stored license
   * @returns {Promise<void>}
   */
  async clearLicense() {
    return new Promise((resolve) => {
      chrome.storage.local.remove(['licenseCode'], resolve);
    });
  }

  /**
   * Check if user has a valid stored license
   * @returns {Promise<{valid: boolean, license?: object, error?: string}>}
   */
  async checkStoredLicense() {
    const storedCode = await this.getStoredLicense();
    if (!storedCode) {
      return { valid: false, error: 'No license stored' };
    }
    return this.validateLicense(storedCode);
  }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.LicenseManager = LicenseManager;
  window.licenseManager = new LicenseManager();
}
