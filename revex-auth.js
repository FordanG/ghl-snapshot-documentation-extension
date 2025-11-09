// GHL Utils - Revex Authentication
// Uses GHL's built-in revexBackendService via message bridge

let requestIdCounter = 0;
const pendingRequests = new Map();
let isRevexReady = false;
let revexReadyPromise = null;
let revexReadyResolve = null;
const requestQueue = [];

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
function sendRequest(type, endpoint, data, requestId, resolve, reject) {
  // Send request to inject.js
  window.postMessage({
    type,
    endpoint,
    data,
    requestId
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
async function makeRevexRequest(type, endpoint, data = null) {
  const requestId = ++requestIdCounter;

  return new Promise((resolve, reject) => {
    // Store the promise handlers
    pendingRequests.set(requestId, { resolve, reject });

    // If Revex is ready, send immediately
    if (isRevexReady) {
      sendRequest(type, endpoint, data, requestId, resolve, reject);
    } else {
      // Otherwise, queue the request
      console.log('[Revex] Queueing request until ready:', type, endpoint);
      requestQueue.push(() => {
        sendRequest(type, endpoint, data, requestId, resolve, reject);
      });
    }
  });
}

// Make GET request using Revex
async function revexGet(endpoint) {
  console.log('[Revex] GET:', endpoint);

  try {
    const response = await makeRevexRequest('REVEX_GET', endpoint);
    console.log('[Revex] GET response:', response.status, endpoint);
    return response;
  } catch (error) {
    console.error('[Revex] GET error:', error);
    throw error;
  }
}

// Make POST request using Revex
async function revexPost(endpoint, data) {
  console.log('[Revex] POST:', endpoint, data);

  try {
    const response = await makeRevexRequest('REVEX_POST', endpoint, data);
    console.log('[Revex] POST response:', response.status, endpoint);
    return response;
  } catch (error) {
    console.error('[Revex] POST error:', error);
    throw error;
  }
}

// Make PUT request using Revex
async function revexPut(endpoint, data) {
  console.log('[Revex] PUT:', endpoint, data);

  try {
    const response = await makeRevexRequest('REVEX_PUT', endpoint, data);
    console.log('[Revex] PUT response:', response.status, endpoint);
    return response;
  } catch (error) {
    console.error('[Revex] PUT error:', error);
    throw error;
  }
}

// Get location ID from page URL
function getLocationId() {
  // Try from URL
  const urlMatch = window.location.href.match(/\/location\/([A-Za-z0-9_-]{18,28})/);
  if (urlMatch && urlMatch[1]) {
    console.log('[Revex] Location ID from URL:', urlMatch[1]);
    return urlMatch[1];
  }

  console.warn('[Revex] Could not determine location ID from URL');
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

// Export functions to global scope
window.ghlUtilsRevex = {
  get: revexGet,
  post: revexPost,
  put: revexPut,
  getLocationId: getLocationId,
  waitForReady: waitForReady,
  isReady: () => isRevexReady
};

console.log('[Revex] Auth module ready');
