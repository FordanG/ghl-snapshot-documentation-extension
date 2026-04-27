// GHL Utils - Revex Authentication
// Uses GHL's built-in revexBackendService via message bridge

let requestIdCounter = 0;
const pendingRequests = new Map();
let isRevexReady = false;
let revexReadyPromise = null;
let revexReadyResolve = null;
const requestQueue = [];

// GHL page detection state
let isGHLPage = false;
let ghlPageData = null;
let ghlAuthToken = null;
let ghlLocationId = null;
let ghlDetectionComplete = false;
let ghlDetectionPromise = null;
let ghlDetectionResolve = null;

// Create a promise that resolves when GHL detection is complete
function createGHLDetectionPromise() {
  if (!ghlDetectionPromise) {
    ghlDetectionPromise = new Promise((resolve) => {
      ghlDetectionResolve = resolve;
    });
  }
  return ghlDetectionPromise;
}

// Initialize GHL detection promise
createGHLDetectionPromise();

// Create a promise that resolves when Revex is ready
function createReadyPromise() {
  if (!revexReadyPromise) {
    revexReadyPromise = new Promise((resolve) => {
      revexReadyResolve = resolve;
    });
  }
  return revexReadyPromise;
}

// Listen for responses from inject.js
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  // Handle GHL page data response (detection)
  if (event.data.type === 'GHL_PAGE_DATA_RESPONSE') {
    console.log('[Revex] GHL page data received:', {
      hasGHLData: event.data.hasGHLData,
      hasAuthToken: !!event.data.authToken,
      locationId: event.data.locationId
    });

    isGHLPage = event.data.hasGHLData || !!event.data.authToken;
    ghlPageData = event.data.data;
    ghlAuthToken = event.data.authToken;
    ghlLocationId = event.data.locationId;
    ghlDetectionComplete = true;

    if (ghlDetectionResolve) {
      ghlDetectionResolve({
        isGHLPage,
        hasAuthToken: !!ghlAuthToken,
        locationId: ghlLocationId
      });
    }

    console.log('[Revex] GHL detection complete. Is GHL page:', isGHLPage);
    return;
  }

  // Handle readiness signal
  if (event.data.type === 'REVEX_READY') {
    console.log('[Revex] Received ready signal:', event.data.success);
    if (event.data.success) {
      isRevexReady = true;
      if (revexReadyResolve) {
        revexReadyResolve();
      }
      console.log('[Revex] Revex is ready! Processing queued requests:', requestQueue.length);

      // Process any queued requests
      while (requestQueue.length > 0) {
        const queuedRequest = requestQueue.shift();
        queuedRequest();
      }
    } else {
      console.error('[Revex] Revex initialization failed:', event.data.error);
      if (revexReadyResolve) {
        revexReadyResolve(); // Resolve anyway to prevent hanging, requests will fail with proper errors
      }
    }
    return;
  }

  // Handle API responses
  if (event.data.type !== 'REVEX_RESPONSE') return;

  const { requestId, success, data, status, error } = event.data;
  const pending = pendingRequests.get(requestId);

  if (pending) {
    pendingRequests.delete(requestId);
    if (success) {
      pending.resolve({ data, status });
    } else {
      pending.reject(new Error(error || 'Unknown error'));
    }
  }
});

// Initialize ready promise
createReadyPromise();

// Wait for Revex to be ready
async function waitForReady(timeout = 15000) {
  console.log('[Revex] Waiting for Revex to be ready...');

  if (isRevexReady) {
    console.log('[Revex] Already ready!');
    return true;
  }

  // Race between ready promise and timeout
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Revex initialization timeout')), timeout);
  });

  try {
    await Promise.race([revexReadyPromise, timeoutPromise]);
    console.log('[Revex] Ready!');
    return true;
  } catch (error) {
    console.error('[Revex] Failed to initialize:', error);
    throw error;
  }
}

// Make a request via the message bridge (internal function)
function sendRequest(type, endpoint, data, requestId, resolve, reject, baseUrl = null) {
  // Send request to inject.js
  window.postMessage({
    type,
    endpoint,
    data,
    requestId,
    baseUrl
  }, '*');

  // Timeout after 30 seconds
  setTimeout(() => {
    if (pendingRequests.has(requestId)) {
      pendingRequests.delete(requestId);
      reject(new Error('Request timeout'));
    }
  }, 30000);
}

// Make a request via the message bridge
async function makeRevexRequest(type, endpoint, data = null, baseUrl = null) {
  const requestId = ++requestIdCounter;

  return new Promise((resolve, reject) => {
    // Store the promise handlers
    pendingRequests.set(requestId, { resolve, reject });

    // If Revex is ready, send immediately
    if (isRevexReady) {
      sendRequest(type, endpoint, data, requestId, resolve, reject, baseUrl);
    } else {
      // Otherwise, queue the request
      console.log('[Revex] Queueing request until ready:', type, endpoint);
      requestQueue.push(() => {
        sendRequest(type, endpoint, data, requestId, resolve, reject, baseUrl);
      });
    }
  });
}

// Make GET request using Revex
// baseUrl: 'backend' (default) or 'services' to choose base URL
async function revexGet(endpoint, baseUrl = null) {
  console.log('[Revex] GET:', endpoint, baseUrl ? `(base: ${baseUrl})` : '');

  try {
    const response = await makeRevexRequest('REVEX_GET', endpoint, null, baseUrl);
    console.log('[Revex] GET response:', response.status, endpoint);
    return response;
  } catch (error) {
    console.error('[Revex] GET error:', error);
    throw error;
  }
}

// Make POST request using Revex
// baseUrl: 'backend' (default) or 'services' to choose base URL
async function revexPost(endpoint, data, baseUrl = null) {
  console.log('[Revex] POST:', endpoint, baseUrl ? `(base: ${baseUrl})` : '', data);

  try {
    const response = await makeRevexRequest('REVEX_POST', endpoint, data, baseUrl);
    console.log('[Revex] POST response:', response.status, endpoint);
    return response;
  } catch (error) {
    console.error('[Revex] POST error:', error);
    throw error;
  }
}

// Make PUT request using Revex
// baseUrl: 'backend' (default) or 'services' to choose base URL
async function revexPut(endpoint, data, baseUrl = null) {
  console.log('[Revex] PUT:', endpoint, baseUrl ? `(base: ${baseUrl})` : '', data);

  try {
    const response = await makeRevexRequest('REVEX_PUT', endpoint, data, baseUrl);
    console.log('[Revex] PUT response:', response.status, endpoint);
    return response;
  } catch (error) {
    console.error('[Revex] PUT error:', error);
    throw error;
  }
}

// Make flexible fetch request with custom URL and options
// Supports any HTTP method and any base URL (not just backend.leadconnectorhq.com)
// Usage: fetch(url, { method: 'GET', body: {...}, headers: {...} })
async function revexFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  console.log('[Revex] FETCH:', method, url);

  try {
    const response = await makeRevexRequest('REVEX_FETCH', url, {
      method,
      body: options.body,
      headers: options.headers
    });
    console.log('[Revex] FETCH response:', response.status, url);
    return response;
  } catch (error) {
    console.error('[Revex] FETCH error:', error);
    throw error;
  }
}

// Get location ID - uses cached value from detection or falls back to URL parsing
function getLocationId() {
  // First try the cached locationId from inject.js detection
  if (ghlLocationId) {
    console.log('[Revex] Location ID from cached detection:', ghlLocationId);
    return ghlLocationId;
  }

  // Fallback: extract from URL
  const urlMatch = window.location.href.match(/\/location\/([A-Za-z0-9_-]{18,28})/);
  if (urlMatch && urlMatch[1]) {
    console.log('[Revex] Location ID from URL:', urlMatch[1]);
    return urlMatch[1];
  }

  console.warn('[Revex] Could not determine location ID');
  return null;
}

// Initialize and expose to window
console.log('[Revex] Initializing Revex auth module');

// Inject the page scripts to access Vue app and expose exporter
function injectPageScript() {
  console.log('[Revex] Injecting page scripts...');

  // Inject inject.js first (for Vue app access)
  const injectScript = document.createElement('script');
  injectScript.src = chrome.runtime.getURL('inject.js');
  injectScript.onload = function() {
    console.log('[Revex] Inject script loaded successfully');
    this.remove();
  };
  injectScript.onerror = function() {
    console.error('[Revex] Failed to load inject.js');
    this.remove();
  };
  (document.head || document.documentElement).appendChild(injectScript);

  // Inject page-exporter.js into page context (so console can access it)
  const exporterScript = document.createElement('script');
  exporterScript.src = chrome.runtime.getURL('page-exporter.js');
  exporterScript.onload = function() {
    console.log('[Revex] Page exporter script loaded in page context');
    this.remove();
  };
  exporterScript.onerror = function() {
    console.error('[Revex] Failed to load page-exporter.js');
    this.remove();
  };
  (document.head || document.documentElement).appendChild(exporterScript);
}

// Wait for DOM and inject script
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(injectPageScript, 500);
  });
} else {
  setTimeout(injectPageScript, 500);
}

// Wait for GHL detection to complete
async function waitForGHLDetection(timeout = 5000) {
  console.log('[Revex] Waiting for GHL detection...');

  // First, try direct URL-based detection (fastest and most reliable for GHL app)
  const urlLocationId = getLocationId();
  const hostname = window.location.hostname;
  const isGHLDomain = hostname.includes('gohighlevel.com') ||
                      hostname.includes('leadconnectorhq.com') ||
                      hostname.includes('highlevel.com');

  if (urlLocationId || isGHLDomain) {
    console.log('[Revex] Direct detection: GHL page detected via URL/domain');
    const result = {
      isGHLPage: true,
      hasAuthToken: !!ghlAuthToken,
      locationId: urlLocationId || ghlLocationId
    };
    // Update cached values
    if (urlLocationId && !ghlLocationId) {
      ghlLocationId = urlLocationId;
    }
    isGHLPage = true;
    ghlDetectionComplete = true;
    return result;
  }

  // If not detected via URL, wait for inject.js detection
  if (ghlDetectionComplete) {
    console.log('[Revex] Detection already complete, isGHLPage:', isGHLPage);
    return { isGHLPage, hasAuthToken: !!ghlAuthToken, locationId: ghlLocationId };
  }

  // Race between detection promise and timeout
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      console.log('[Revex] GHL detection timeout - checking URL fallback');
      // Final fallback: check URL one more time
      const fallbackLocationId = getLocationId();
      if (fallbackLocationId) {
        resolve({ isGHLPage: true, hasAuthToken: false, locationId: fallbackLocationId });
      } else {
        resolve({ isGHLPage: false, hasAuthToken: false, locationId: null, timeout: true });
      }
    }, timeout);
  });

  try {
    const result = await Promise.race([ghlDetectionPromise, timeoutPromise]);
    console.log('[Revex] GHL detection result:', result);
    return result;
  } catch (error) {
    console.error('[Revex] GHL detection error:', error);
    return { isGHLPage: false, hasAuthToken: false, locationId: null, error: error.message };
  }
}

// Export functions to global scope
window.ghlUtilsRevex = {
  get: revexGet,
  post: revexPost,
  put: revexPut,
  fetch: revexFetch,
  getLocationId: getLocationId,
  waitForReady: waitForReady,
  isReady: () => isRevexReady,
  // GHL detection functions
  isGHLPage: () => isGHLPage,
  waitForGHLDetection: waitForGHLDetection,
  getGHLDetectionState: () => ({
    isGHLPage,
    ghlDetectionComplete,
    hasAuthToken: !!ghlAuthToken,
    locationId: ghlLocationId
  })
};

console.log('[Revex] Auth module ready');
