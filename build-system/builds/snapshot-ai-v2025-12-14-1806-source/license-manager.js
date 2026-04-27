/**
 * License Manager for Super Snapshots AI
 * Handles license validation and usage tracking via Supabase
 */

const LICENSE_CONFIG = {
  SUPABASE_URL: 'https://aggtrjiseqoeottcrbuw.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnZ3RyamlzZXFvZW90dGNyYnV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MzYxOTIsImV4cCI6MjA4MDUxMjE5Mn0.Q26hVW2CbyihiR6lia7YMVQ_wN74I9F_gVK-njydYoI'
};

/**
 * License Manager Class
 */
class LicenseManager {
  constructor() {
    this.supabaseUrl = LICENSE_CONFIG.SUPABASE_URL;
    this.supabaseKey = LICENSE_CONFIG.SUPABASE_ANON_KEY;
    this.cachedLicense = null;
  }

  /**
   * Make a request to Supabase REST API
   */
  async supabaseRequest(endpoint, options = {}) {
    const url = `${this.supabaseUrl}/rest/v1/${endpoint}`;
    const headers = {
      'apikey': this.supabaseKey,
      'Authorization': `Bearer ${this.supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation'
    };

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase error: ${error}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
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

      // Fetch license from Supabase
      const licenses = await this.supabaseRequest(
        `licenses?license_code=eq.${encodeURIComponent(code)}&select=*`
      );

      if (!licenses || licenses.length === 0) {
        return { valid: false, error: 'Invalid license code' };
      }

      const license = licenses[0];

      // Check if license is active
      if (!license.is_active) {
        return { valid: false, error: 'License has been deactivated' };
      }

      // Check expiration
      if (license.expires_at && new Date(license.expires_at) < new Date()) {
        return { valid: false, error: 'License has expired' };
      }

      // Get usage count
      const usageData = await this.supabaseRequest(
        `license_usage?license_id=eq.${license.id}&select=id`,
        { prefer: 'count=exact' }
      );

      const usageCount = Array.isArray(usageData) ? usageData.length : 0;

      // Check max uses (if set)
      if (license.max_uses !== null && usageCount >= license.max_uses) {
        return {
          valid: false,
          error: `License usage limit reached (${usageCount}/${license.max_uses})`,
          usageCount
        };
      }

      // Cache the valid license
      this.cachedLicense = license;

      return {
        valid: true,
        license,
        usageCount,
        remainingUses: license.max_uses ? license.max_uses - usageCount : 'unlimited'
      };

    } catch (error) {
      console.error('[LicenseManager] Validation error:', error);
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

      // First validate the license
      const validation = await this.validateLicense(code);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Record usage
      const usageRecord = {
        license_id: validation.license.id,
        snapshot_id: metadata.snapshotId || null,
        company_id: metadata.companyId || null,
        user_agent: navigator.userAgent || null
      };

      await this.supabaseRequest('license_usage', {
        method: 'POST',
        body: usageRecord
      });

      return { success: true, usageCount: (validation.usageCount || 0) + 1 };

    } catch (error) {
      console.error('[LicenseManager] Usage recording error:', error);
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
