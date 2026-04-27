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
    return;
  }

  // Handle readiness signal
  if (event.data.type === 'REVEX_READY') {
    if (event.data.success) {
      isRevexReady = true;
      if (revexReadyResolve) {
        revexReadyResolve();
      }

      // Process any queued requests
      while (requestQueue.length > 0) {
        const queuedRequest = requestQueue.shift();
        queuedRequest();
      }
    } else {
      if (revexReadyResolve) {
        revexReadyResolve();
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
  if (isRevexReady) {
    return true;
  }

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Revex initialization timeout')), timeout);
  });

  try {
    await Promise.race([revexReadyPromise, timeoutPromise]);
    return true;
  } catch (error) {
    throw error;
  }
}

// Make a request via the message bridge (internal function)
function sendRequest(type, endpoint, data, requestId, resolve, reject, baseUrl = null) {
  window.postMessage({
    type,
    endpoint,
    data,
    requestId,
    baseUrl
  }, '*');

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
    pendingRequests.set(requestId, { resolve, reject });

    if (isRevexReady) {
      sendRequest(type, endpoint, data, requestId, resolve, reject, baseUrl);
    } else {
      requestQueue.push(() => {
        sendRequest(type, endpoint, data, requestId, resolve, reject, baseUrl);
      });
    }
  });
}

// Make GET request using Revex
async function revexGet(endpoint, baseUrl = null) {
  const response = await makeRevexRequest('REVEX_GET', endpoint, null, baseUrl);
  return response;
}

// Make POST request using Revex
async function revexPost(endpoint, data, baseUrl = null) {
  const response = await makeRevexRequest('REVEX_POST', endpoint, data, baseUrl);
  return response;
}

// Make PUT request using Revex
async function revexPut(endpoint, data, baseUrl = null) {
  const response = await makeRevexRequest('REVEX_PUT', endpoint, data, baseUrl);
  return response;
}

// Make flexible fetch request with custom URL and options
async function revexFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();

  const response = await makeRevexRequest('REVEX_FETCH', url, {
    method,
    body: options.body,
    headers: options.headers
  });
  return response;
}

// Get location ID - uses cached value from detection or falls back to URL parsing
function getLocationId() {
  if (ghlLocationId) {
    return ghlLocationId;
  }

  const urlMatch = window.location.href.match(/\/location\/([A-Za-z0-9_-]{18,28})/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  return null;
}

// Inject the page scripts to access Vue app and expose exporter
function injectPageScript() {
  // Inject inject.js first (for Vue app access)
  const injectScript = document.createElement('script');
  injectScript.src = chrome.runtime.getURL('inject.js');
  injectScript.onload = function() {
    this.remove();
  };
  injectScript.onerror = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(injectScript);

  // Inject page-exporter.js into page context
  const exporterScript = document.createElement('script');
  exporterScript.src = chrome.runtime.getURL('page-exporter.js');
  exporterScript.onload = function() {
    this.remove();
  };
  exporterScript.onerror = function() {
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
  // First, try direct URL-based detection (fastest and most reliable for GHL app)
  const urlLocationId = getLocationId();
  const hostname = window.location.hostname;
  const isGHLDomain = hostname.includes('gohighlevel.com') ||
                      hostname.includes('leadconnectorhq.com') ||
                      hostname.includes('highlevel.com');

  if (urlLocationId || isGHLDomain) {
    const result = {
      isGHLPage: true,
      hasAuthToken: !!ghlAuthToken,
      locationId: urlLocationId || ghlLocationId
    };
    if (urlLocationId && !ghlLocationId) {
      ghlLocationId = urlLocationId;
    }
    isGHLPage = true;
    ghlDetectionComplete = true;
    return result;
  }

  // If not detected via URL, wait for inject.js detection
  if (ghlDetectionComplete) {
    return { isGHLPage, hasAuthToken: !!ghlAuthToken, locationId: ghlLocationId };
  }

  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
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
    return result;
  } catch (error) {
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
  isGHLPage: () => isGHLPage,
  waitForGHLDetection: waitForGHLDetection,
  getGHLDetectionState: () => ({
    isGHLPage,
    ghlDetectionComplete,
    hasAuthToken: !!ghlAuthToken,
    locationId: ghlLocationId
  })
};
