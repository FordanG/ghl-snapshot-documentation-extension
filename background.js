/**
 * GHL Snapshot Export - Background Service Worker
 */

// Listen for extension installation or updates
chrome.runtime.onInstalled.addListener((details) => {
  // Extension installed or updated
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle OpenAI API calls from content scripts
  if (request.action === 'callOpenAI') {
    (async () => {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${request.apiKey}`
          },
          body: JSON.stringify({
            model: request.model || 'gpt-4o-mini',
            messages: request.messages,
            temperature: request.temperature || 0.7,
            max_tokens: request.maxTokens || 500
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.error?.message || response.statusText;
          sendResponse({
            success: false,
            error: `OpenAI API error (${response.status}): ${errorMsg}`
          });
          return;
        }

        const data = await response.json();
        sendResponse({ success: true, data: data });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true; // Keep the message channel open for async response
  }

  // Forward location export progress and persist to storage
  if (request.action === 'locationExportProgress') {
    const isComplete = request.progress >= 100;
    const isError = request.progress === 0 && request.message && request.message.startsWith('Error:');
    chrome.storage.local.set({
      locationExportState: {
        isExporting: !isComplete && !isError,
        progress: request.progress,
        message: request.message,
        timestamp: Date.now()
      }
    });

    // Clear export state after completion or error (with small delay)
    if (isComplete || isError) {
      setTimeout(() => {
        chrome.storage.local.set({
          locationExportState: { isExporting: false, progress: 0, message: '' }
        });
      }, 3000);
    }

    // Broadcast to all extension views (popup)
    chrome.runtime.sendMessage(request).catch(() => {
      // Popup might be closed, that's ok - state is persisted
    });
  }

  return false;
});
