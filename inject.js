// This script runs in the page context to access GHL's Nuxt app data and auth token
(function() {
  console.log('[Inject.js] Script running in page context');

  let pageData = {};
  let hasGHLData = false;
  let authToken = null;
  let locationId = null;

  // Try Nuxt 3 (most reliable for GHL pages)
  try {
    if (typeof useNuxtApp === 'function') {
      const nuxtApp = useNuxtApp();
      pageData = nuxtApp?.payload?.data?.pageData || {};
      if (pageData && (pageData.pageId || pageData.funnelId || pageData.stepId || pageData.locationId)) {
        hasGHLData = true;
        locationId = pageData.locationId;
        console.log('[Inject.js] Found Nuxt 3 data, locationId:', locationId);
      }
    }
  } catch(e) {
    console.log('[Inject.js] Nuxt 3 not available:', e.message);
  }

  // Try Nuxt 2
  if (!hasGHLData) {
    try {
      if (window.__NUXT__) {
        const nuxtData = window.__NUXT__.data?.[0]?.pageData || window.__NUXT__.pageData || {};
        pageData = {...pageData, ...nuxtData};
        if (pageData && (pageData.pageId || pageData.funnelId || pageData.stepId || pageData.locationId)) {
          hasGHLData = true;
          locationId = pageData.locationId;
          console.log('[Inject.js] Found Nuxt 2 data, locationId:', locationId);
        }
      }
    } catch(e) {
      console.log('[Inject.js] Nuxt 2 not available:', e.message);
    }
  }

  // Extract auth token from localStorage
  try {
    console.log('[Inject.js] Checking localStorage for auth token...');

    // Primary location: localStorage key 'a' contains base64-encoded JSON
    const authDataStr = localStorage.getItem('a');
    console.log('[Inject.js] localStorage.a exists:', !!authDataStr);
    console.log('[Inject.js] localStorage.a length:', authDataStr ? authDataStr.length : 0);

    if (authDataStr) {
      try {
        let authData;

        // localStorage.a is JSON-stringified, so first parse to remove quotes
        let unquotedStr = authDataStr;
        if (authDataStr.startsWith('"') && authDataStr.endsWith('"')) {
          console.log('[Inject.js] Removing JSON quotes from localStorage.a...');
          unquotedStr = JSON.parse(authDataStr);
          console.log('[Inject.js] Unquoted string length:', unquotedStr.length);
        }

        // Check if it's base64-encoded (starts with eyJ which decodes to {)
        if (unquotedStr.startsWith('eyJ')) {
          console.log('[Inject.js] Detected base64-encoded data, decoding...');
          // Decode base64
          const decodedStr = atob(unquotedStr);
          console.log('[Inject.js] Decoded string length:', decodedStr.length);
          console.log('[Inject.js] Decoded preview:', decodedStr.substring(0, 100));
          authData = JSON.parse(decodedStr);
        } else {
          // Try direct JSON parse
          authData = JSON.parse(unquotedStr);
        }

        console.log('[Inject.js] Parsed auth data, keys:', Object.keys(authData));

        // Use authToken (longer RS256 token) which works with snapshot APIs
        // jwt is a shorter HS256 token that doesn't work with all endpoints
        authToken = authData.authToken || authData.jwt;
        if (authToken) {
          // Remove "Bearer " prefix if present
          authToken = authToken.replace(/^Bearer\s+/i, '');
          console.log('[Inject.js] Token found in localStorage.a (using authToken), length:', authToken.length);

          // Also extract locationId/companyId from the auth data
          if (authData.companyId) {
            locationId = authData.companyId;
            console.log('[Inject.js] Company ID from auth data:', locationId);
          }
        } else {
          console.log('[Inject.js] No jwt or authToken field in parsed data');
        }
      } catch(parseError) {
        console.error('[Inject.js] Failed to decode/parse auth data:', parseError);
        console.log('[Inject.js] First 100 chars of authDataStr:', authDataStr.substring(0, 100));
      }
    } else {
      console.log('[Inject.js] localStorage.a is empty/null');
    }

    // Fallback: try legacy auth storage locations
    if (!authToken) {
      console.log('[Inject.js] Trying fallback auth locations...');
      const legacyToken = localStorage.getItem('auth._token.laravelJWT') ||
                         localStorage.getItem('auth.token') ||
                         localStorage.getItem('token') ||
                         localStorage.getItem('jwt');
      if (legacyToken) {
        authToken = legacyToken.replace(/^Bearer\s+/i, '');
        console.log('[Inject.js] Token found in fallback location, length:', authToken.length);
      } else {
        console.log('[Inject.js] No fallback tokens found');
      }
    }
  } catch(e) {
    console.error('[Inject.js] localStorage not accessible:', e);
  }

  console.log('[Inject.js] Final state - hasAuth:', !!authToken, 'hasData:', hasGHLData, 'locationId:', locationId);

  // Send data back to content script
  window.postMessage({
    type: 'GHL_PAGE_DATA_RESPONSE',
    data: pageData,
    hasGHLData: hasGHLData,
    authToken: authToken,
    locationId: locationId
  }, '*');

  console.log('[Inject.js] Message posted to content script');

  // Expose Revex service to window for content scripts
  const REVEX_URL = 'https://backend.leadconnectorhq.com';
  let revexService = null;
  let isRevexReady = false;

  function getRevexService() {
    // Return cached service if available
    if (revexService) {
      return revexService;
    }

    const app = document.querySelector("#app");
    if (!app || !app.__vue_app__) {
      console.log('[Inject.js] Vue app not found yet');
      return null;
    }

    const revex = app.__vue_app__.config.globalProperties.revexBackendService;
    if (!revex) {
      console.log('[Inject.js] revexBackendService not found in Vue app');
      return null;
    }

    console.log('[Inject.js] Revex service found and cached');
    revexService = revex;
    return revex;
  }

  // Wait for Vue app and Revex to be available
  function initializeRevex() {
    console.log('[Inject.js] Starting Revex initialization...');

    let attempts = 0;
    const maxAttempts = 50; // 10 seconds max (50 * 200ms)

    const checkInterval = setInterval(() => {
      attempts++;

      const revex = getRevexService();
      if (revex) {
        clearInterval(checkInterval);
        isRevexReady = true;
        console.log('[Inject.js] Revex initialization complete!');

        // Signal to content script that Revex is ready
        window.postMessage({
          type: 'REVEX_READY',
          success: true
        }, '*');
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        console.error('[Inject.js] Revex initialization timeout - Vue app not found');

        window.postMessage({
          type: 'REVEX_READY',
          success: false,
          error: 'Vue app not found after timeout'
        }, '*');
      } else {
        console.log(`[Inject.js] Waiting for Vue app... (attempt ${attempts}/${maxAttempts})`);
      }
    }, 200);
  }

  // Create a message-based API bridge
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;

    const { type, endpoint, data: reqData, requestId } = event.data;

    // Handle readiness check requests
    if (type === 'REVEX_CHECK_READY') {
      window.postMessage({
        type: 'REVEX_READY',
        success: isRevexReady
      }, '*');
      return;
    }

    // Handle API requests
    if (!type || !type.startsWith('REVEX_')) return;
    if (type === 'REVEX_READY' || type === 'REVEX_RESPONSE') return;

    try {
      if (!isRevexReady) {
        throw new Error('Revex service not initialized yet');
      }

      const revex = getRevexService();
      if (!revex) {
        throw new Error('Revex service not available');
      }

      let response;
      const fullUrl = REVEX_URL + endpoint;

      // For snapshot-appengine endpoints, use direct fetch with Bearer token
      const needsDirectFetch = endpoint.includes('/snapshots-appengine/');
      const needsBearerAuth = endpoint.includes('/snapshots/');

      if (needsDirectFetch && authToken) {
        console.log('[Inject.js] Using direct fetch for snapshot-appengine with Bearer auth');

        const headers = {
          'Authorization': `Bearer ${authToken}`,
          'channel': 'APP',
          'source': 'WEB_USER',
          'version': '2021-07-28',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };

        let fetchResponse;
        switch (type) {
          case 'REVEX_GET':
            fetchResponse = await fetch(fullUrl, {
              method: 'GET',
              headers: headers,
              credentials: 'omit'
            });
            break;
          case 'REVEX_POST':
            fetchResponse = await fetch(fullUrl, {
              method: 'POST',
              headers: headers,
              body: JSON.stringify(reqData),
              credentials: 'omit'
            });
            break;
          case 'REVEX_PUT':
            fetchResponse = await fetch(fullUrl, {
              method: 'PUT',
              headers: headers,
              body: JSON.stringify(reqData),
              credentials: 'omit'
            });
            break;
          default:
            throw new Error('Unknown request type');
        }

        if (!fetchResponse.ok) {
          throw new Error(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`);
        }

        const data = await fetchResponse.json();
        response = { data, status: fetchResponse.status };

      } else if (needsBearerAuth && authToken) {
        console.log('[Inject.js] Adding Bearer token and required headers for snapshot API');
        const config = {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'channel': 'APP',
            'source': 'WEB_USER',
            'version': '2021-07-28'
          }
        };

        switch (type) {
          case 'REVEX_GET':
            response = await revex.get(fullUrl, config);
            break;
          case 'REVEX_POST':
            response = await revex.post(fullUrl, reqData, config);
            break;
          case 'REVEX_PUT':
            response = await revex.put(fullUrl, reqData, config);
            break;
          default:
            throw new Error('Unknown request type');
        }
      } else {
        // Use standard Revex authentication for other endpoints
        switch (type) {
          case 'REVEX_GET':
            response = await revex.get(fullUrl);
            break;
          case 'REVEX_POST':
            response = await revex.post(fullUrl, reqData);
            break;
          case 'REVEX_PUT':
            response = await revex.put(fullUrl, reqData);
            break;
          default:
            throw new Error('Unknown request type');
        }
      }

      window.postMessage({
        type: 'REVEX_RESPONSE',
        requestId,
        success: true,
        data: response.data,
        status: response.status
      }, '*');
    } catch (error) {
      console.error('[Inject.js] Revex API error:', error);
      window.postMessage({
        type: 'REVEX_RESPONSE',
        requestId,
        success: false,
        error: error.message || 'Unknown error'
      }, '*');
    }
  });

  console.log('[Inject.js] Revex message bridge ready, starting initialization...');

  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeRevex);
  } else {
    // DOM already loaded, start immediately
    setTimeout(initializeRevex, 100);
  }
})();
