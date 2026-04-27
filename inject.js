// This script runs in the page context to access GHL's Nuxt app data and auth token
(function() {
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
      }
    }
  } catch(e) {}

  // Try Nuxt 2
  if (!hasGHLData) {
    try {
      if (window.__NUXT__) {
        const nuxtData = window.__NUXT__.data?.[0]?.pageData || window.__NUXT__.pageData || {};
        pageData = {...pageData, ...nuxtData};
        if (pageData && (pageData.pageId || pageData.funnelId || pageData.stepId || pageData.locationId)) {
          hasGHLData = true;
          locationId = pageData.locationId;
        }
      }
    } catch(e) {}
  }

  // Extract auth token from localStorage
  try {
    // Primary location: localStorage key 'a' contains base64-encoded JSON
    const authDataStr = localStorage.getItem('a');

    if (authDataStr) {
      try {
        let authData;

        // localStorage.a is JSON-stringified, so first parse to remove quotes
        let unquotedStr = authDataStr;
        if (authDataStr.startsWith('"') && authDataStr.endsWith('"')) {
          unquotedStr = JSON.parse(authDataStr);
        }

        // Check if it's base64-encoded (starts with eyJ which decodes to {)
        if (unquotedStr.startsWith('eyJ')) {
          const decodedStr = atob(unquotedStr);
          authData = JSON.parse(decodedStr);
        } else {
          authData = JSON.parse(unquotedStr);
        }

        // Use authToken (longer RS256 token) which works with snapshot APIs
        // jwt is a shorter HS256 token that doesn't work with all endpoints
        authToken = authData.authToken || authData.jwt;
        if (authToken) {
          // Remove "Bearer " prefix if present
          authToken = authToken.replace(/^Bearer\s+/i, '');

          // Store companyId for later use as last resort fallback
          if (authData.companyId) {
            window._ghlAuthCompanyId = authData.companyId;
          }
        }
      } catch(parseError) {}
    }

    // Fallback: try legacy auth storage locations
    if (!authToken) {
      const legacyToken = localStorage.getItem('auth._token.laravelJWT') ||
                         localStorage.getItem('auth.token') ||
                         localStorage.getItem('token') ||
                         localStorage.getItem('jwt');
      if (legacyToken) {
        authToken = legacyToken.replace(/^Bearer\s+/i, '');
      }
    }
  } catch(e) {}

  // Fallback 1: extract locationId from URL if not found yet
  if (!locationId) {
    const urlMatch = window.location.href.match(/\/location\/([A-Za-z0-9_-]{18,28})/);
    if (urlMatch && urlMatch[1]) {
      locationId = urlMatch[1];
      hasGHLData = true;
    }
  }

  // Fallback 2 (last resort): use companyId from auth data
  if (!locationId && window._ghlAuthCompanyId) {
    locationId = window._ghlAuthCompanyId;
  }

  // Also check if this is a known GHL domain
  const hostname = window.location.hostname;
  const isGHLDomain = hostname.includes('gohighlevel.com') ||
                      hostname.includes('leadconnectorhq.com') ||
                      hostname.includes('highlevel.com');
  if (isGHLDomain && !hasGHLData) {
    hasGHLData = true;
  }

  // Send data back to content script
  window.postMessage({
    type: 'GHL_PAGE_DATA_RESPONSE',
    data: pageData,
    hasGHLData: hasGHLData,
    authToken: authToken,
    locationId: locationId
  }, '*');

  // Expose Revex service to window for content scripts
  const BASE_URLS = {
    backend: 'https://backend.leadconnectorhq.com',
    services: 'https://services.leadconnectorhq.com'
  };
  const DEFAULT_BASE = 'backend';
  let revexService = null;
  let isRevexReady = false;

  function getRevexService() {
    if (revexService) {
      return revexService;
    }

    const app = document.querySelector("#app");
    if (!app || !app.__vue_app__) {
      return null;
    }

    const revex = app.__vue_app__.config.globalProperties.revexBackendService;
    if (!revex) {
      return null;
    }

    revexService = revex;
    return revex;
  }

  // Wait for Vue app and Revex to be available
  function initializeRevex() {
    let attempts = 0;
    const maxAttempts = 50;

    const checkInterval = setInterval(() => {
      attempts++;

      const revex = getRevexService();
      if (revex) {
        clearInterval(checkInterval);
        isRevexReady = true;

        window.postMessage({
          type: 'REVEX_READY',
          success: true
        }, '*');
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);

        if (authToken) {
          isRevexReady = true;

          window.postMessage({
            type: 'REVEX_READY',
            success: true,
            fallbackMode: true
          }, '*');
        } else {
          window.postMessage({
            type: 'REVEX_READY',
            success: false,
            error: 'Vue app not found after timeout and no auth token available'
          }, '*');
        }
      }
    }, 200);
  }

  // Create a message-based API bridge
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;

    const { type, endpoint, data: reqData, requestId, baseUrl } = event.data;

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
      const revex = getRevexService();
      const useDirectFetch = !revex && authToken;

      if (!isRevexReady && !useDirectFetch) {
        throw new Error('Revex service not initialized and no auth token available');
      }

      if (!revex && !authToken) {
        throw new Error('Revex service not available and no auth token for fallback');
      }

      let response;

      // Handle REVEX_FETCH - flexible fetch with custom URLs and any HTTP method
      if (type === 'REVEX_FETCH') {
        if (!authToken) {
          throw new Error('Auth token not available for fetch request');
        }

        const method = reqData?.method || 'GET';
        const customHeaders = reqData?.headers || {};

        const headers = {
          'Authorization': `Bearer ${authToken}`,
          'channel': 'APP',
          'source': 'WEB_USER',
          'version': '2021-07-28',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...customHeaders
        };

        const fetchOptions = {
          method: method,
          headers: headers,
          credentials: 'omit'
        };

        if (reqData?.body && !['GET', 'HEAD'].includes(method)) {
          fetchOptions.body = typeof reqData.body === 'string'
            ? reqData.body
            : JSON.stringify(reqData.body);
        }

        const fetchResponse = await fetch(endpoint, fetchOptions);

        if (!fetchResponse.ok) {
          throw new Error(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`);
        }

        const data = await fetchResponse.json();
        response = { data, status: fetchResponse.status };

        window.postMessage({
          type: 'REVEX_RESPONSE',
          requestId,
          success: true,
          data: response.data,
          status: response.status
        }, '*');
        return;
      }

      // Determine which base URL to use
      const selectedBase = baseUrl && BASE_URLS[baseUrl] ? BASE_URLS[baseUrl] : BASE_URLS[DEFAULT_BASE];
      const fullUrl = selectedBase + endpoint;

      // For snapshot-appengine endpoints, use direct fetch with Bearer token
      const needsDirectFetch = endpoint.includes('/snapshots-appengine/');
      const needsBearerAuth = endpoint.includes('/snapshots/');

      if (needsDirectFetch && authToken) {
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
      } else if (useDirectFetch) {
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

      } else {
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
      window.postMessage({
        type: 'REVEX_RESPONSE',
        requestId,
        success: false,
        error: error.message || 'Unknown error'
      }, '*');
    }
  });

  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeRevex);
  } else {
    setTimeout(initializeRevex, 100);
  }
})();
