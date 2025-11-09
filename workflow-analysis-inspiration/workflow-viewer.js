// Workflow Viewer - Side Panel for Workflow Analysis
// This script creates a side panel that displays workflow analysis

let workflowPanelElement = null;
let currentWorkflowData = null;
let currentWorkflowAnalysis = null;

// Initialize workflow viewer on workflow pages
function initWorkflowViewer() {
  // Check if we're on a workflow page
  const url = window.location.href;
  const workflowMatch = url.match(
    /\/workflow\/([A-Za-z0-9_-]{16,})(?:\/|$|\?)/
  );

  if (workflowMatch) {
    const workflowId = workflowMatch[1];
    console.log("[Workflow Viewer] On workflow page:", workflowId);

    // Store workflow ID for popup to access
    window.ghlUtilsCurrentWorkflowId = workflowId;
  } else {
    window.ghlUtilsCurrentWorkflowId = null;
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openWorkflowAnalysis") {
    const workflowId = request.workflowId || window.ghlUtilsCurrentWorkflowId;
    if (workflowId) {
      openWorkflowPanel(workflowId);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "No workflow ID found" });
    }
    return true;
  } else if (request.action === "getWorkflowId") {
    sendResponse({ workflowId: window.ghlUtilsCurrentWorkflowId });
    return true;
  } else if (request.action === "exportAllWorkflows") {
    // Start export process asynchronously
    exportAllWorkflows()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("[Workflow Export] Error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }
});

// DEPRECATED: Button injection code (kept for reference, not used)
function addWorkflowAnalysisButton_DEPRECATED(workflowId) {
  // Check if button already exists
  const existingButton = document.getElementById("ghl-workflow-analysis-btn");
  if (existingButton) {
    // Update workflow ID if it changed
    existingButton.dataset.workflowId = workflowId;
    console.log("[Workflow Viewer] Button already exists, updated workflow ID");
    return;
  }

  // Try multiple strategies to find the toolbar (supports both old and new builder)
  let targetToolbar = null;

  // NEW BUILDER - LEFT SIDEBAR (for iframe-based builder)

  // Strategy 0: Find the left sidebar rail
  const leftSidebar = document.querySelector(".left-toolbar-rail");
  if (leftSidebar) {
    // Find the container with all the icon buttons
    const iconContainer = leftSidebar.querySelector("[data-v-7d2b926e]");
    if (iconContainer) {
      targetToolbar = iconContainer;
      console.log(
        "[Workflow Viewer] Found toolbar: left sidebar (new builder iframe)"
      );
    }
  }

  // NEW BUILDER STRATEGIES (text-based detection)

  // Strategy 1: Find "Saved" button in new builder
  const savedButton = Array.from(document.querySelectorAll("button")).find(
    (btn) =>
      btn.textContent.trim() === "Saved" || btn.textContent.trim() === "Save"
  );
  if (savedButton) {
    // Get the parent container (usually a flex container with other buttons)
    targetToolbar = savedButton.parentElement;
    console.log(
      '[Workflow Viewer] Found toolbar via "Saved" button (new builder)'
    );
  }

  // Strategy 2: Find "Publish" or "Test Workflow" button area
  if (!targetToolbar) {
    const publishButton = Array.from(document.querySelectorAll("button")).find(
      (btn) =>
        btn.textContent.includes("Publish") ||
        btn.textContent.includes("Test Workflow")
    );
    if (publishButton) {
      targetToolbar = publishButton.parentElement;
      console.log(
        '[Workflow Viewer] Found toolbar via "Publish"/"Test Workflow" button (new builder)'
      );
    }
  }

  // Strategy 3: Find the top-right button container (contains undo/redo/saved buttons)
  if (!targetToolbar) {
    const containers = document.querySelectorAll(
      "div.flex.items-center, div.flex.gap-2"
    );
    for (const container of containers) {
      const hasUndoRedo = Array.from(container.querySelectorAll("button")).some(
        (btn) =>
          btn.getAttribute("aria-label")?.includes("Undo") ||
          btn.getAttribute("aria-label")?.includes("Redo")
      );
      if (hasUndoRedo) {
        targetToolbar = container;
        console.log(
          "[Workflow Viewer] Found toolbar via undo/redo buttons (new builder)"
        );
        break;
      }
    }
  }

  // OLD BUILDER STRATEGIES (ID-based detection)

  // Strategy 4: Look for hl-toolbar-group (original)
  if (!targetToolbar) {
    const toolbarGroups = document.querySelectorAll(".hl-toolbar-group");
    if (toolbarGroups.length > 0) {
      targetToolbar = toolbarGroups[toolbarGroups.length - 1];
      console.log(
        "[Workflow Viewer] Found toolbar using .hl-toolbar-group (old builder)"
      );
    }
  }

  // Strategy 5: Look for the save button's parent container (old builder)
  if (!targetToolbar) {
    const saveButton = document.querySelector(
      "#cmp-header__btn--save-workflow"
    );
    if (saveButton) {
      targetToolbar =
        saveButton.closest(".hl-toolbar-group") ||
        saveButton.closest("[data-v-ebf9b9fa]");
      if (targetToolbar) {
        console.log(
          "[Workflow Viewer] Found toolbar via save button parent (old builder)"
        );
      }
    }
  }

  if (!targetToolbar) {
    // Debug: Log what we can find
    const allButtons = document.querySelectorAll("button");
    console.log("[Workflow Viewer] Toolbar not found. Debugging:");
    console.log("  - Total buttons on page:", allButtons.length);

    // Log all button text content to see what we have
    if (allButtons.length > 0 && allButtons.length < 20) {
      console.log(
        "  - Button texts:",
        Array.from(allButtons)
          .map((b) => `"${b.textContent.trim()}"`)
          .join(", ")
      );
    }

    // Check for new builder buttons (case-insensitive)
    const savedBtn = Array.from(allButtons).find((b) => {
      const text = b.textContent.toLowerCase();
      return text.includes("saved") || text.includes("save");
    });
    const publishBtn = Array.from(allButtons).find((b) =>
      b.textContent.toLowerCase().includes("publish")
    );
    const testBtn = Array.from(allButtons).find((b) =>
      b.textContent.toLowerCase().includes("test")
    );
    const draftBtn = Array.from(allButtons).find((b) =>
      b.textContent.toLowerCase().includes("draft")
    );

    console.log('  - "Saved/Save" button exists:', !!savedBtn);
    console.log('  - "Publish" button exists:', !!publishBtn);
    console.log('  - "Test" button exists:', !!testBtn);
    console.log('  - "Draft" button exists:', !!draftBtn);

    // Check for old builder buttons
    console.log(
      "  - Old builder save button:",
      !!document.querySelector("#cmp-header__btn--save-workflow")
    );
    console.log(
      "  - Old builder back button:",
      !!document.querySelector("#cmp-header__link--workflow-list")
    );

    // Check for iframes
    const iframes = document.querySelectorAll("iframe");
    console.log("  - Iframes on page:", iframes.length);

    // Try to find ANY button with relevant text and use its parent
    const anyRelevantButton = savedBtn || publishBtn || testBtn || draftBtn;
    if (anyRelevantButton) {
      targetToolbar = anyRelevantButton.parentElement;
      console.log("[Workflow Viewer] Using fallback: relevant button parent");
    }
  }

  if (!targetToolbar) {
    console.log(
      "[Workflow Viewer] ❌ Could not find any suitable location for button"
    );
    return;
  }

  console.log(
    "[Workflow Viewer] Target toolbar found:",
    targetToolbar.className || "[no class]"
  );

  // Determine if we're injecting into left sidebar
  const isLeftSidebar = targetToolbar.closest(".left-toolbar-rail");

  // Create button matching the location's style
  const button = document.createElement("div");
  button.id = "ghl-workflow-analysis-btn";
  button.dataset.workflowId = workflowId;
  button.setAttribute("data-ghl-utils", "true");
  button.setAttribute("role", "button");
  button.setAttribute("aria-label", "Analyze Workflow");
  button.setAttribute("title", "Analyze Workflow");

  if (isLeftSidebar) {
    // Style for left sidebar (icon only)
    button.setAttribute("data-v-7d2b926e", "");
    button.className =
      "p-2 mb-3 cursor-pointer hover:bg-orange-50 transition-colors rounded-lg";
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true" class="h-5 w-5 text-orange-500 focus:outline-none">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    `;
  } else {
    // Style for top toolbar (with text)
    button.setAttribute("data-v-7b49d4f8", "");
    button.setAttribute("data-v-ebf9b9fa", "");
    button.className =
      "n-button n-button--default-type n-button--medium-type quaternary icon-only hl-text-btn customButton rounded-lg border border-orange-500 bg-white hover:bg-orange-50 hover:border-orange-600 transition-colors";
    button.setAttribute("tabindex", "0");
    button.setAttribute("type", "button");
    button.style.cssText = `
      --n-bezier: cubic-bezier(.4, 0, .2, 1);
      --n-bezier-ease-out: cubic-bezier(0, 0, .2, 1);
      --n-ripple-duration: .6s;
      --n-opacity-disabled: 0.5;
      --n-wave-opacity: 0.6;
      font-weight: 400;
      --n-color: #0000;
      --n-color-hover: #0000;
      --n-color-pressed: #0000;
      --n-color-focus: #0000;
      --n-color-disabled: #0000;
      --n-ripple-color: #0000;
      --n-text-color: rgba(52, 64, 84, 1);
      --n-text-color-hover: #FB8500;
      --n-text-color-pressed: #FF9500;
      --n-text-color-focus: #FB8500;
      --n-text-color-disabled: rgba(52, 64, 84, 1);
      --n-border: none;
      --n-border-hover: none;
      --n-border-pressed: none;
      --n-border-focus: none;
      --n-border-disabled: none;
      --n-width: initial;
      --n-height: initial;
      --n-font-size: 14px;
      --n-padding: 0 14px;
      --n-icon-size: 18px;
      --n-icon-margin: 6px;
      --n-border-radius: 8px;
      margin-right: 8px;
    `;
    button.innerHTML = `
      <span class="n-button__content">
        <span style="font-size: 16px; margin-right: 4px;">📊</span>
        <span>Analyze</span>
      </span>
    `;
  }

  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const currentWorkflowId = button.dataset.workflowId;
    openWorkflowPanel(currentWorkflowId);
  });

  // Insert button into toolbar
  if (isLeftSidebar) {
    // For left sidebar, insert near the bottom (before the AI icon if it exists)
    const aiIcon = targetToolbar
      .querySelector(".text-purple-700")
      ?.closest("[data-v-7d2b926e]");
    if (aiIcon && aiIcon.parentElement === targetToolbar) {
      targetToolbar.insertBefore(button, aiIcon);
      console.log(
        "[Workflow Viewer] Button inserted before AI icon in sidebar"
      );
    } else {
      targetToolbar.appendChild(button);
      console.log("[Workflow Viewer] Button appended to sidebar");
    }
  } else {
    // For top toolbar, try to insert before save button
    const saveButtonParent =
      targetToolbar.querySelector(".relative.pt-1.pr-1.ml-2") ||
      targetToolbar.querySelector('[id*="save-workflow"]')?.parentElement ||
      targetToolbar.querySelector('button[id*="save"]')?.parentElement;

    if (saveButtonParent && saveButtonParent.parentElement === targetToolbar) {
      targetToolbar.insertBefore(button, saveButtonParent);
      console.log("[Workflow Viewer] Button inserted before save button");
    } else {
      targetToolbar.appendChild(button);
      console.log("[Workflow Viewer] Button appended to toolbar");
    }
  }

  console.log(
    "[Workflow Viewer] ✅ Button successfully added to",
    isLeftSidebar ? "sidebar" : "toolbar"
  );
}

function removeWorkflowAnalysisButton_DEPRECATED() {
  const button = document.getElementById("ghl-workflow-analysis-btn");
  if (button) {
    button.remove();
  }
}

// Create the workflow panel
function createWorkflowPanel() {
  // Check if panel already exists in DOM (might have been created before)
  let panel = document.getElementById("ghl-workflow-panel");

  if (panel) {
    console.log("[Workflow Viewer] Panel already exists in DOM");
    workflowPanelElement = panel;
    return panel;
  }

  if (workflowPanelElement) {
    return workflowPanelElement;
  }

  console.log("[Workflow Viewer] Creating new panel");
  panel = document.createElement("div");
  panel.id = "ghl-workflow-panel";

  // Mark as GHL Utils element to prevent Vue from removing it
  panel.setAttribute("data-ghl-utils", "true");
  panel.setAttribute("data-ghl-utils-panel", "true");

  panel.innerHTML = `
    <div class="ghl-wf-header">
      <h2>Workflow Analysis</h2>
      <div class="ghl-wf-header-actions">
        <button class="ghl-wf-btn" id="ghl-wf-refresh">↻ Refresh</button>
        <button class="ghl-wf-close" id="ghl-wf-close">&times;</button>
      </div>
    </div>
    <div class="ghl-wf-content" id="ghl-wf-content">
      <div class="ghl-wf-loading">
        <div style="text-align: center;">
          <div class="ghl-wf-spinner"></div>
          <div>Loading workflow data...</div>
        </div>
      </div>
    </div>
  `;

  // Ensure panel is appended to body (not inside Vue app)
  document.body.appendChild(panel);
  workflowPanelElement = panel;

  // Prevent Vue from removing our elements
  Object.defineProperty(panel, "remove", {
    value: function () {
      console.log("[Workflow Viewer] Prevented panel removal");
      // Don't actually remove, just hide
      this.classList.remove("visible");
    },
    writable: false,
    configurable: false,
  });

  console.log("[Workflow Viewer] Panel created and protected");

  // Setup event listeners
  const closeBtn = panel.querySelector("#ghl-wf-close");
  closeBtn.addEventListener("click", closeWorkflowPanel);

  const refreshBtn = panel.querySelector("#ghl-wf-refresh");
  refreshBtn.addEventListener("click", () => {
    if (currentWorkflowData) {
      fetchAndDisplayWorkflow(
        currentWorkflowData.locationId,
        currentWorkflowData._id
      );
    }
  });

  return panel;
}

// Open workflow panel
async function openWorkflowPanel(workflowId) {
  const panel = createWorkflowPanel();

  // Get location ID
  const locationId = currentLocationId;

  if (!locationId) {
    showWorkflowError(
      "Location ID not detected. Please ensure you are on a GHL page."
    );
    return;
  }

  // Show panel with loading state
  panel.classList.add("visible");

  // Fetch workflow data
  await fetchAndDisplayWorkflow(locationId, workflowId);
}

// Close workflow panel
function closeWorkflowPanel() {
  if (workflowPanelElement) {
    workflowPanelElement.classList.remove("visible");
  }
}

// Fetch workflow data using Revex backend service (avoids CORS)
async function fetchAndDisplayWorkflow(locationId, workflowId) {
  const contentDiv = document.getElementById("ghl-wf-content");

  // Show loading state
  contentDiv.innerHTML = `
    <div class="ghl-wf-loading">
      <div style="text-align: center;">
        <div class="ghl-wf-spinner"></div>
        <div>Fetching workflow data...</div>
      </div>
    </div>
  `;

  try {
    // Use Revex backend service via revex-auth.js
    const endpoint = `/workflow/${locationId}/${workflowId}?includeScheduledPauseInfo=true`;

    // Wait for Revex to be ready
    if (
      window.ghlUtilsRevex &&
      typeof window.ghlUtilsRevex.waitForReady === "function"
    ) {
      console.log("[Workflow Viewer] Waiting for Revex to be ready...");
      await window.ghlUtilsRevex.waitForReady();
      console.log("[Workflow Viewer] Revex is ready!");
    }

    // Make API call through Revex
    if (!window.ghlUtilsRevex || !window.ghlUtilsRevex.get) {
      throw new Error("Revex service not available. Please refresh the page.");
    }

    console.log(
      "[Workflow Viewer] Fetching workflow data via Revex:",
      endpoint
    );
    const response = await window.ghlUtilsRevex.get(endpoint);
    console.log("[Workflow Viewer] Response received:", response);

    if (!response || !response.data) {
      throw new Error("No data returned from API");
    }

    const workflowData = response.data;
    currentWorkflowData = workflowData;

    console.log("[Workflow Viewer] Workflow data loaded, analyzing...");

    // Analyze workflow
    const analysis = window.analyzeGHLWorkflowComplete(workflowData);
    currentWorkflowAnalysis = analysis;

    console.log("[Workflow Viewer] Analysis complete:", analysis);

    // Add AI analysis if OpenAI key is configured
    try {
      console.log("[Workflow Viewer] Running AI analysis...");
      contentDiv.innerHTML = `
        <div class="ghl-wf-loading">
          <div style="text-align: center;">
            <div class="ghl-wf-spinner"></div>
            <div>Analyzing workflow with AI...</div>
          </div>
        </div>
      `;

      const aiAnalysis = await analyzeWorkflowWithAI(workflowData);
      analysis.aiAnalysis = aiAnalysis;
      console.log("[Workflow Viewer] AI analysis complete");
    } catch (error) {
      console.error("[Workflow Viewer] AI analysis failed:", error);
      // Continue without AI analysis if it fails
    }

    // Display analysis
    displayWorkflowAnalysis(analysis);
  } catch (error) {
    console.error("[GHL Utils] Error fetching workflow:", error);
    showWorkflowError(`Failed to fetch workflow data: ${error.message}`);
  }
}

// Display workflow error
function showWorkflowError(message) {
  const contentDiv = document.getElementById("ghl-wf-content");
  contentDiv.innerHTML = `
    <div class="ghl-wf-error">
      <strong>Error:</strong> ${message}
    </div>
  `;
}

// Format AI concerns text to HTML
function formatAIConcerns(text) {
  if (!text) return "";

  // Split by lines
  let lines = text.split("\n");
  let html = '<ul style="margin: 0; padding-left: 20px;">';

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Remove leading dash and asterisks
    let cleaned = trimmed.replace(/^[-•]\s*\*\*/, "").replace(/\*\*:?\s*/g, "");

    // Check if line starts with bullet/dash
    if (trimmed.startsWith("-") || trimmed.startsWith("•")) {
      // Extract the concern category if it exists (text before first colon)
      const colonIndex = cleaned.indexOf(":");
      if (colonIndex > 0 && colonIndex < 50) {
        const category = cleaned.substring(0, colonIndex);
        const description = cleaned.substring(colonIndex + 1).trim();
        html += `<li style="margin-bottom: 8px;"><strong style="color: #dc2626;">${escapeHtml(
          category
        )}:</strong> ${escapeHtml(description)}</li>`;
      } else {
        html += `<li style="margin-bottom: 8px;">${escapeHtml(cleaned)}</li>`;
      }
    } else if (cleaned) {
      // Not a bullet point, just add as paragraph
      html += `<p style="margin: 8px 0;">${escapeHtml(cleaned)}</p>`;
    }
  });

  html += "</ul>";
  return html;
}

// Display workflow analysis
function displayWorkflowAnalysis(analysis) {
  const contentDiv = document.getElementById("ghl-wf-content");

  const html = `
    <!-- Basic Info -->
    <div class="ghl-wf-section">
      <div class="ghl-wf-section-title">Workflow Info</div>
      <div class="ghl-wf-info-grid">
        <div class="ghl-wf-info-row">
          <span class="ghl-wf-info-label">Name:</span>
          <span class="ghl-wf-info-value">${escapeHtml(
            analysis.workflowName
          )}</span>
        </div>
        <div class="ghl-wf-info-row">
          <span class="ghl-wf-info-label">Status:</span>
          <span class="ghl-wf-status ${analysis.status}">${
    analysis.status
  }</span>
        </div>
        <div class="ghl-wf-info-row">
          <span class="ghl-wf-info-label">Version:</span>
          <span class="ghl-wf-info-value">${analysis.version}</span>
        </div>
        <div class="ghl-wf-info-row">
          <span class="ghl-wf-info-label">Created:</span>
          <span class="ghl-wf-info-value">${formatDate(
            analysis.createdAt
          )}</span>
        </div>
        <div class="ghl-wf-info-row">
          <span class="ghl-wf-info-label">Updated:</span>
          <span class="ghl-wf-info-value">${formatDate(
            analysis.updatedAt
          )}</span>
        </div>
      </div>
    </div>

    ${
      analysis.aiAnalysis
        ? `
    <!-- AI Analysis -->
    <div class="ghl-wf-section" style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-left: 4px solid #0ea5e9;">
      <div class="ghl-wf-section-title" style="color: #0369a1;">
        <span style="margin-right: 8px;">🤖</span>AI Analysis
      </div>

      <div style="margin-bottom: 16px;">
        <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px; color: #0369a1;">Flow Explanation</div>
        <div style="background: white; padding: 12px; border-radius: 6px; font-size: 13px; line-height: 1.6; color: #334155;">
          ${escapeHtml(analysis.aiAnalysis.flowExplanation)}
        </div>
      </div>

      <div>
        <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px; color: #dc2626;">Potential Concerns</div>
        <div style="background: white; padding: 12px; border-radius: 6px; font-size: 13px; line-height: 1.6; color: #334155;">
          ${formatAIConcerns(analysis.aiAnalysis.concerns)}
        </div>
      </div>
    </div>
    `
        : ""
    }

    <!-- Summary Cards -->
    <div class="ghl-wf-section">
      <div class="ghl-wf-section-title">Quick Summary</div>
      <div class="ghl-wf-summary-grid">
        <div class="ghl-wf-summary-card">
          <span class="ghl-wf-summary-number">${analysis.actions.length}</span>
          <span class="ghl-wf-summary-label">Total Actions</span>
        </div>
        <div class="ghl-wf-summary-card">
          <span class="ghl-wf-summary-number">${
            analysis.conditions.length
          }</span>
          <span class="ghl-wf-summary-label">Conditions</span>
        </div>
        <div class="ghl-wf-summary-card">
          <span class="ghl-wf-summary-number">${
            analysis.messages.sms.length + analysis.messages.email.length
          }</span>
          <span class="ghl-wf-summary-label">Messages</span>
        </div>
        <div class="ghl-wf-summary-card">
          <span class="ghl-wf-summary-number">${analysis.tags.length}</span>
          <span class="ghl-wf-summary-label">Tags</span>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="ghl-wf-section">
      <div class="ghl-wf-section-title">
        Actions
        <span class="ghl-wf-badge">${analysis.actions.length}</span>
      </div>
      ${
        analysis.actions.length > 0
          ? analysis.actions
              .slice(0, 10)
              .map(
                (action) => `
          <div class="ghl-wf-action-item">
            <div class="ghl-wf-action-header">
              <div class="ghl-wf-action-name">${escapeHtml(action.name)}</div>
              <div class="ghl-wf-action-type">${escapeHtml(action.type)}</div>
            </div>
            <div class="ghl-wf-action-id">ID: ${action.id}</div>
          </div>
        `
              )
              .join("") +
            (analysis.actions.length > 10
              ? '<div class="ghl-wf-empty">...and ' +
                (analysis.actions.length - 10) +
                " more</div>"
              : "")
          : '<div class="ghl-wf-empty">No actions found</div>'
      }
    </div>

    <!-- Tags -->
    <div class="ghl-wf-section">
      <div class="ghl-wf-section-title">
        Tags
        <span class="ghl-wf-badge">${analysis.tags.length}</span>
      </div>
      ${
        analysis.tags.length > 0
          ? analysis.tags
              .map(
                (tag) => `<span class="ghl-wf-tag">${escapeHtml(tag)}</span>`
              )
              .join("")
          : '<div class="ghl-wf-empty">No tags found</div>'
      }
    </div>

    <!-- Messages -->
    <div class="ghl-wf-section">
      <div class="ghl-wf-section-title">Messages</div>

      ${
        analysis.messages.sms.length > 0
          ? `
        <div style="margin-bottom: 16px;">
          <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px;">SMS Messages (${
            analysis.messages.sms.length
          })</div>
          ${analysis.messages.sms
            .map(
              (msg) => `
            <div class="ghl-wf-list-item">
              <div class="ghl-wf-list-item-title">${escapeHtml(msg.name)}</div>
              <div class="ghl-wf-list-item-detail" style="white-space: pre-wrap;">${escapeHtml(msg.message)}</div>
            </div>
          `
            )
            .join("")}
        </div>
      `
          : ""
      }

      ${
        analysis.messages.email.length > 0
          ? `
        <div style="margin-bottom: 16px;">
          <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px;">Email Messages (${
            analysis.messages.email.length
          })</div>
          ${analysis.messages.email
            .map(
              (msg) => `
            <div class="ghl-wf-list-item">
              <div class="ghl-wf-list-item-title">${escapeHtml(msg.name)}</div>
              <div class="ghl-wf-list-item-detail">Subject: ${escapeHtml(
                msg.subject
              )}</div>
            </div>
          `
            )
            .join("")}
        </div>
      `
          : ""
      }

      ${
        analysis.messages.sms.length === 0 &&
        analysis.messages.email.length === 0
          ? '<div class="ghl-wf-empty">No messages found</div>'
          : ""
      }
    </div>

    <!-- Webhook Fields -->
    ${
      analysis.webhookFields.length > 0
        ? `
      <div class="ghl-wf-section">
        <div class="ghl-wf-section-title">
          Webhook Fields
          <span class="ghl-wf-badge">${analysis.webhookFields.length}</span>
        </div>
        ${analysis.webhookFields
          .map(
            (field) => `<span class="ghl-wf-tag">${escapeHtml(field)}</span>`
          )
          .join("")}
      </div>
    `
        : ""
    }

    <!-- Conditions -->
    ${
      analysis.conditions.length > 0
        ? `
      <div class="ghl-wf-section">
        <div class="ghl-wf-section-title">
          Conditions
          <span class="ghl-wf-badge">${analysis.conditions.length}</span>
        </div>
        ${analysis.conditions
          .slice(0, 5)
          .map(
            (cond) => `
          <div class="ghl-wf-list-item">
            <div class="ghl-wf-list-item-title">${escapeHtml(cond.name)}</div>
            <div class="ghl-wf-list-item-detail">
              Parent: ${escapeHtml(cond.parentAction)} |
              Condition: ${escapeHtml(cond.condition)} |
              Primary: ${cond.isPrimary ? "Yes" : "No"}
            </div>
          </div>
        `
          )
          .join("")}
        ${
          analysis.conditions.length > 5
            ? '<div class="ghl-wf-empty">...and ' +
              (analysis.conditions.length - 5) +
              " more</div>"
            : ""
        }
      </div>
    `
        : ""
    }

    <!-- Contact Actions -->
    ${
      analysis.contactActions.create.length > 0 ||
      analysis.contactActions.update.length > 0 ||
      analysis.contactActions.addTag.length > 0 ||
      analysis.contactActions.removeTag.length > 0
        ? `
      <div class="ghl-wf-section">
        <div class="ghl-wf-section-title">Contact Actions</div>

        ${
          analysis.contactActions.create.length > 0
            ? `
          <div style="margin-bottom: 12px;">
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px;">Create Contact (${
              analysis.contactActions.create.length
            })</div>
            ${analysis.contactActions.create
              .map(
                (action) => `
              <div class="ghl-wf-list-item">
                <div class="ghl-wf-list-item-title">${escapeHtml(
                  action.name
                )}</div>
              </div>
            `
              )
              .join("")}
          </div>
        `
            : ""
        }

        ${
          analysis.contactActions.update.length > 0
            ? `
          <div style="margin-bottom: 12px;">
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px;">Update Contact (${
              analysis.contactActions.update.length
            })</div>
            ${analysis.contactActions.update
              .map(
                (action) => `
              <div class="ghl-wf-list-item">
                <div class="ghl-wf-list-item-title">${escapeHtml(
                  action.name
                )}</div>
              </div>
            `
              )
              .join("")}
          </div>
        `
            : ""
        }

        ${
          analysis.contactActions.addTag.length > 0
            ? `
          <div style="margin-bottom: 12px;">
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px;">Add Tags (${
              analysis.contactActions.addTag.length
            })</div>
            ${analysis.contactActions.addTag
              .map(
                (action) => `
              <div class="ghl-wf-list-item">
                <div class="ghl-wf-list-item-title">${escapeHtml(
                  action.name
                )}</div>
                <div class="ghl-wf-list-item-detail">Tags: ${action.tags
                  .map((t) => escapeHtml(t))
                  .join(", ")}</div>
              </div>
            `
              )
              .join("")}
          </div>
        `
            : ""
        }

        ${
          analysis.contactActions.removeTag.length > 0
            ? `
          <div style="margin-bottom: 12px;">
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px;">Remove Tags (${
              analysis.contactActions.removeTag.length
            })</div>
            ${analysis.contactActions.removeTag
              .map(
                (action) => `
              <div class="ghl-wf-list-item">
                <div class="ghl-wf-list-item-title">${escapeHtml(
                  action.name
                )}</div>
                <div class="ghl-wf-list-item-detail">Tags: ${action.tags
                  .map((t) => escapeHtml(t))
                  .join(", ")}</div>
              </div>
            `
              )
              .join("")}
          </div>
        `
            : ""
        }
      </div>
    `
        : ""
    }

    <!-- AI Actions -->
    ${
      analysis.aiActions.length > 0
        ? `
      <div class="ghl-wf-section">
        <div class="ghl-wf-section-title">
          AI Actions
          <span class="ghl-wf-badge">${analysis.aiActions.length}</span>
        </div>
        ${analysis.aiActions
          .map(
            (ai) => `
          <div class="ghl-wf-list-item">
            <div class="ghl-wf-list-item-title">${escapeHtml(ai.name)}</div>
            ${
              ai.prompt
                ? `<div class="ghl-wf-list-item-detail" style="white-space: pre-wrap;">Prompt: ${escapeHtml(ai.prompt)}</div>`
                : ""
            }
          </div>
        `
          )
          .join("")}
      </div>
    `
        : ""
    }

    <!-- API Calls & Webhooks -->
    ${
      analysis.apiCalls.length > 0 || analysis.webhooks.length > 0
        ? `
      <div class="ghl-wf-section">
        <div class="ghl-wf-section-title">API & Webhooks</div>

        ${
          analysis.apiCalls.length > 0
            ? `
          <div style="margin-bottom: 12px;">
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px;">API Calls (${
              analysis.apiCalls.length
            })</div>
            ${analysis.apiCalls
              .map(
                (api) => `
              <div class="ghl-wf-list-item">
                <div class="ghl-wf-list-item-title">${escapeHtml(
                  api.name
                )}</div>
                <div class="ghl-wf-list-item-detail">${api.method} ${escapeHtml(
                  api.url || "N/A"
                )}</div>
              </div>
            `
              )
              .join("")}
          </div>
        `
            : ""
        }

        ${
          analysis.webhooks.length > 0
            ? `
          <div style="margin-bottom: 12px;">
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px;">Webhooks (${
              analysis.webhooks.length
            })</div>
            ${analysis.webhooks
              .map(
                (webhook) => `
              <div class="ghl-wf-list-item">
                <div class="ghl-wf-list-item-title">${escapeHtml(
                  webhook.name
                )}</div>
                <div class="ghl-wf-list-item-detail">${
                  webhook.method
                } ${escapeHtml(webhook.url || "N/A")}</div>
              </div>
            `
              )
              .join("")}
          </div>
        `
            : ""
        }
      </div>
    `
        : ""
    }
  `;

  contentDiv.innerHTML = html;
}

// Utility functions
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString() + " " + date.toLocaleTimeString();
}

// Initialize on page load with VERY aggressive retries for toolbar (new builder loads slowly)
const retryTimes = [
  0, 300, 500, 800, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000,
  10000, 12000, 15000, 20000, 30000,
];

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    retryTimes.forEach((time) => setTimeout(initWorkflowViewer, time));
  });
} else {
  retryTimes.forEach((time) => setTimeout(initWorkflowViewer, time));
}

console.log(
  "[Workflow Viewer] Scheduled",
  retryTimes.length,
  "initialization attempts over 30 seconds"
);

// Re-initialize when URL changes (for SPA navigation)
let lastWorkflowUrl = window.location.href;

function handleWorkflowUrlChange() {
  const currentUrl = window.location.href;
  if (currentUrl !== lastWorkflowUrl) {
    lastWorkflowUrl = currentUrl;
    setTimeout(initWorkflowViewer, 500);
    setTimeout(initWorkflowViewer, 1500); // Retry after Vue loads
    setTimeout(initWorkflowViewer, 3000); // Final retry
  }
}

// Watch for URL changes
const workflowUrlObserver = new MutationObserver(handleWorkflowUrlChange);
workflowUrlObserver.observe(
  document.querySelector("head > title") || document.body,
  {
    subtree: true,
    characterData: true,
    childList: true,
  }
);

window.addEventListener("popstate", handleWorkflowUrlChange);

// Intercept pushState and replaceState
const origPushState = history.pushState;
const origReplaceState = history.replaceState;

history.pushState = function () {
  origPushState.apply(this, arguments);
  handleWorkflowUrlChange();
};

history.replaceState = function () {
  origReplaceState.apply(this, arguments);
  handleWorkflowUrlChange();
};

// MutationObserver to watch for toolbar changes and re-add button
let lastToolbarCheck = 0;

const toolbarObserver = new MutationObserver((mutations) => {
  const url = window.location.href;
  const workflowMatch = url.match(
    /\/workflow\/([A-Za-z0-9_-]{16,})(?:\/|$|\?)/
  );

  if (!workflowMatch) return;

  const workflowId = workflowMatch[1];
  const now = Date.now();

  // Check button (throttled to once per second)
  if (now - lastToolbarCheck > 1000) {
    const button = document.getElementById("ghl-workflow-analysis-btn");
    if (!button) {
      // Check if toolbar is available
      const toolbar = document.querySelector(".hl-toolbar");
      if (toolbar) {
        addWorkflowAnalysisButton(workflowId);
      }
    }
    lastToolbarCheck = now;
  }
});

// Start observing for toolbar changes
if (document.body) {
  toolbarObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// Also check periodically (every 2 seconds) to ensure button exists
setInterval(() => {
  const url = window.location.href;
  const workflowMatch = url.match(
    /\/workflow\/([A-Za-z0-9_-]{16,})(?:\/|$|\?)/
  );

  if (workflowMatch) {
    const workflowId = workflowMatch[1];
    const button = document.getElementById("ghl-workflow-analysis-btn");
    const toolbar = document.querySelector(".hl-toolbar");

    if (!button && toolbar) {
      addWorkflowAnalysisButton(workflowId);
    }

    // Ensure panel stays in DOM
    const panel = document.getElementById("ghl-workflow-panel");
    if (!panel && workflowPanelElement) {
      try {
        document.body.appendChild(workflowPanelElement);
      } catch (e) {
        workflowPanelElement = null;
      }
    }
  }
}, 2000);

// ============================================================================
// WORKFLOW EXPORT FUNCTIONALITY
// ============================================================================

/**
 * Export all workflows in the current location to CSV
 */
async function exportAllWorkflows() {
  console.log("[Workflow Export] Starting export process...");

  try {
    // Get location ID from storage
    const result = await chrome.storage.sync.get(["locationId"]);
    const locationId = result.locationId;

    if (!locationId) {
      throw new Error(
        "Location ID not found. Please set it in extension settings."
      );
    }

    console.log("[Workflow Export] Location ID:", locationId);

    // Send progress update
    chrome.runtime.sendMessage({
      action: "exportProgress",
      message: "Fetching workflow list...",
      progress: 5,
    });

    // Wait for Revex to be ready
    await window.ghlUtilsRevex.waitForReady();

    // Get all workflows for this location
    // Note: GHL API returns all workflows in one request (no pagination needed)
    const workflowsEndpoint = `/workflow/${locationId}`;
    console.log("[Workflow Export] Fetching all workflows...");

    const workflowsResponse = await window.ghlUtilsRevex.get(workflowsEndpoint);
    const workflows =
      workflowsResponse.data.workflows || workflowsResponse.data || [];

    if (!workflows || workflows.length === 0) {
      throw new Error("No workflows found in this location");
    }

    console.log(`[Workflow Export] Found ${workflows.length} workflows`);

    // Send progress update
    chrome.runtime.sendMessage({
      action: "exportProgress",
      message: `Found ${workflows.length} workflows. Fetching details...`,
      progress: 10,
    });

    // Fetch and analyze each workflow
    const allAnalysisResults = [];
    const totalWorkflows = workflows.length;

    for (let i = 0; i < workflows.length; i++) {
      const workflow = workflows[i];
      const workflowId = workflow._id || workflow.id;
      const workflowName = workflow.name || "Unnamed Workflow";

      console.log(
        `[Workflow Export] Processing workflow ${
          i + 1
        }/${totalWorkflows}: ${workflowName} (${workflowId})`
      );

      // Send progress update
      const progress = 10 + (i / totalWorkflows) * 80;
      chrome.runtime.sendMessage({
        action: "exportProgress",
        message: `Analyzing workflow ${
          i + 1
        }/${totalWorkflows}: ${workflowName}`,
        progress: Math.round(progress),
      });

      try {
        // Fetch full workflow data
        const workflowEndpoint = `/workflow/${locationId}/${workflowId}?includeScheduledPauseInfo=true`;
        const workflowResponse = await window.ghlUtilsRevex.get(
          workflowEndpoint
        );
        const workflowData = workflowResponse.data;

        // Analyze the workflow
        const analysis = window.analyzeGHLWorkflowComplete(workflowData);

        // Add AI analysis if OpenAI key is configured
        try {
          const aiAnalysis = await analyzeWorkflowWithAI(workflowData);
          analysis.aiAnalysis = aiAnalysis;
          console.log(
            `[Workflow Export] AI analysis completed for workflow ${
              i + 1
            }/${totalWorkflows}`
          );
        } catch (error) {
          console.error(
            `[Workflow Export] AI analysis failed for workflow ${workflowId}:`,
            error
          );
          analysis.aiAnalysis = {
            flowExplanation: "AI analysis failed",
            concerns: error.message,
          };
        }

        allAnalysisResults.push(analysis);

        console.log(
          `[Workflow Export] Completed workflow ${i + 1}/${totalWorkflows}`
        );

        // Wait 5 seconds before next workflow (except for last one)
        if (i < workflows.length - 1) {
          console.log(
            "[Workflow Export] Waiting 5 seconds before next workflow..."
          );
          await sleep(5000);
        }
      } catch (error) {
        console.error(
          `[Workflow Export] Error fetching workflow ${workflowId}:`,
          error
        );
        // Continue with next workflow even if this one fails
        allAnalysisResults.push({
          workflowName: workflowName,
          workflowId: workflowId,
          error: error.message,
        });
      }
    }

    console.log("[Workflow Export] All workflows processed. Generating CSV...");

    // Send progress update
    chrome.runtime.sendMessage({
      action: "exportProgress",
      message: "Generating CSV file...",
      progress: 95,
    });

    // Convert to CSV
    const csv = convertAnalysisToCSV(allAnalysisResults);

    // Download CSV
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const filename = `GHL_Workflows_Export_${timestamp}.csv`;
    downloadCSV(csv, filename);

    console.log("[Workflow Export] Export complete!");

    // Send completion message
    chrome.runtime.sendMessage({
      action: "exportComplete",
      message: "Export completed successfully!",
      progress: 100,
    });
  } catch (error) {
    console.error("[Workflow Export] Export failed:", error);
    chrome.runtime.sendMessage({
      action: "exportError",
      error: error.message,
    });
    throw error;
  }
}

/**
 * Sleep utility function
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert workflow analysis results to CSV format
 */
function convertAnalysisToCSV(analysisResults) {
  if (!analysisResults || analysisResults.length === 0) {
    return "";
  }

  // Define CSV headers - comprehensive data extraction
  const headers = [
    "Workflow Name",
    "Workflow ID",
    "Status",
    "Version",
    "Created At",
    "Updated At",
    "Location ID",
    "AI Flow Explanation",
    "AI Potential Concerns",
    "Total Actions",
    "Action Types",
    "All Tags",
    "Tags Added (Add Tag Actions)",
    "Tags Removed (Remove Tag Actions)",
    "SMS Message Count",
    "SMS Message Content",
    "Email Message Count",
    "Email Message Subjects",
    "Email Message Content",
    "Manual SMS Count",
    "Manual Email Count",
    "Voicemail Count",
    "Notification Count",
    "Notification Content",
    "Condition Count",
    "Condition Details",
    "Wait/Delay Count",
    "Wait/Delay Details",
    "Opportunity Count",
    "Opportunity Details",
    "Task Count",
    "Task Details",
    "Appointment Count",
    "Note Count",
    "Pipeline/Stage Changes",
    "Custom Field Updates",
    "Webhook Count",
    "Webhook URLs",
    "API Call Count",
    "API Call URLs",
    "AI Action Count",
    "AI Action Details",
    "Integration Count",
    "Campaign Count",
    "Allow Multiple",
    "Timezone",
    "Stop On Response",
    "Error",
    "Raw JSON Data",
  ];

  // Build CSV rows
  const rows = [headers];

  for (const analysis of analysisResults) {
    // Extract action types
    const actionTypes = (analysis.actions || [])
      .map((a) => a.type)
      .filter((v, i, a) => a.indexOf(v) === i) // unique
      .join("; ");

    // Extract tags
    const allTags = (analysis.tags || []).join("; ");
    const tagsAdded = (analysis.contactActions?.addTag || [])
      .map((t) => (t.tags ? t.tags.join(", ") : ""))
      .filter((t) => t)
      .join("; ");
    const tagsRemoved = (analysis.contactActions?.removeTag || [])
      .map((t) => (t.tags ? t.tags.join(", ") : ""))
      .filter((t) => t)
      .join("; ");

    // Extract SMS messages
    const smsMessages = analysis.messages?.sms || [];
    const smsContent = smsMessages.map((msg) => msg.message || "").join(" | ");

    // Extract Email messages
    const emailMessages = analysis.messages?.email || [];
    const emailSubjects = emailMessages
      .map((msg) => msg.subject || "")
      .join(" | ");
    const emailContent = emailMessages
      .map((msg) => (msg.body || "").substring(0, 200)) // Limit email body length
      .join(" | ");

    // Extract Notifications
    const notifications = analysis.notifications || [];
    const notificationContent = notifications
      .map((n) => n.message || n.text || "")
      .join(" | ");

    // Extract Conditions
    const conditions = analysis.conditions || [];
    const conditionDetails = conditions
      .map(
        (c) =>
          `${c.name}: ${c.field || ""} ${c.operator || ""} ${c.value || ""}`
      )
      .join(" | ");

    // Extract Waits/Delays
    const waits = analysis.waits || [];
    const delays = analysis.delays || [];
    const allWaits = [...waits, ...delays];
    const waitDetails = allWaits
      .map((w) => `${w.name}: ${w.duration || ""} ${w.unit || ""}`)
      .join(" | ");

    // Extract Opportunities
    const opportunities = analysis.opportunities || [];
    const opportunityDetails = opportunities
      .map((o) => `${o.name}: ${o.title || ""} (${o.status || ""})`)
      .join(" | ");

    // Extract Tasks
    const tasks = analysis.tasks || [];
    const taskDetails = tasks
      .map((t) => `${t.name}: ${t.title || ""}`)
      .join(" | ");

    // Extract Pipeline changes
    const pipelines = analysis.pipelines || [];
    const pipelineDetails = pipelines
      .map((p) => `${p.name}: ${p.pipeline || ""} -> ${p.stage || ""}`)
      .join(" | ");

    // Extract Custom Field Updates
    const customFieldUpdates = analysis.contactActions?.updateCustomField || [];
    const customFieldDetails = customFieldUpdates
      .map((cf) => `${cf.field}: ${cf.value || ""}`)
      .join(" | ");

    // Extract Webhooks
    const webhooks = analysis.webhooks || [];
    const webhookUrls = webhooks
      .map((w) => w.url || w.webhookUrl || "")
      .filter((u) => u)
      .join(" | ");

    // Extract API Calls
    const apiCalls = analysis.apiCalls || [];
    const apiUrls = apiCalls
      .map((a) => `${a.method || "GET"} ${a.url || ""}`)
      .filter((u) => u.trim() !== "GET")
      .join(" | ");

    // Extract AI Actions
    const aiActions = analysis.aiActions || [];
    const aiDetails = aiActions
      .map((ai) => `${ai.name}: ${ai.prompt || ""}`.substring(0, 100))
      .join(" | ");

    // Stringify the entire analysis object for raw data column
    let rawJsonData = "";
    try {
      rawJsonData = JSON.stringify(analysis);
    } catch (e) {
      rawJsonData = "Error serializing data: " + e.message;
    }

    const row = [
      escapeCSV(analysis.workflowName || ""),
      escapeCSV(analysis.workflowId || ""),
      escapeCSV(analysis.status || ""),
      escapeCSV(analysis.version || ""),
      escapeCSV(analysis.createdAt || ""),
      escapeCSV(analysis.updatedAt || ""),
      escapeCSV(analysis.locationId || ""),
      escapeCSV(analysis.aiAnalysis?.flowExplanation || ""),
      escapeCSV(analysis.aiAnalysis?.concerns || ""),
      (analysis.actions || []).length,
      escapeCSV(actionTypes),
      escapeCSV(allTags),
      escapeCSV(tagsAdded),
      escapeCSV(tagsRemoved),
      smsMessages.length,
      escapeCSV(smsContent),
      emailMessages.length,
      escapeCSV(emailSubjects),
      escapeCSV(emailContent),
      (analysis.messages?.manualSMS || []).length,
      (analysis.messages?.manualEmail || []).length,
      (analysis.messages?.voicemail || []).length,
      notifications.length,
      escapeCSV(notificationContent),
      conditions.length,
      escapeCSV(conditionDetails),
      allWaits.length,
      escapeCSV(waitDetails),
      opportunities.length,
      escapeCSV(opportunityDetails),
      tasks.length,
      escapeCSV(taskDetails),
      (analysis.appointments || []).length,
      (analysis.notes || []).length,
      escapeCSV(pipelineDetails),
      escapeCSV(customFieldDetails),
      webhooks.length,
      escapeCSV(webhookUrls),
      apiCalls.length,
      escapeCSV(apiUrls),
      aiActions.length,
      escapeCSV(aiDetails),
      (analysis.integrations || []).length,
      (analysis.campaigns || []).length,
      escapeCSV(analysis.settings?.allowMultiple?.toString() || ""),
      escapeCSV(analysis.settings?.timezone || ""),
      escapeCSV(analysis.settings?.stopOnResponse?.toString() || ""),
      escapeCSV(analysis.error || ""),
      escapeCSV(rawJsonData),
    ];

    rows.push(row);
  }

  // Convert to CSV string
  return rows.map((row) => row.join(",")).join("\n");
}

/**
 * Escape CSV field value
 */
function escapeCSV(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }

  return stringValue;
}

/**
 * Download CSV file
 */
function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log("[Workflow Export] CSV file downloaded:", filename);
}

// ============================================================================
// AI ANALYSIS FUNCTIONALITY
// ============================================================================

/**
 * Analyze workflow using OpenAI API
 * @param {Object} workflowData - The raw workflow data from API
 * @returns {Promise<Object>} - Object containing flowExplanation and concerns
 */
async function analyzeWorkflowWithAI(workflowData) {
  console.log("[AI Analysis] Starting AI analysis for:", workflowData.name);

  try {
    // Get OpenAI API key and AI analysis setting from storage
    const result = await chrome.storage.sync.get([
      "openaiApiKey",
      "aiAnalysisEnabled",
    ]);
    const apiKey = result.openaiApiKey;
    const aiEnabled =
      result.aiAnalysisEnabled !== undefined ? result.aiAnalysisEnabled : true;

    // Check if AI analysis is enabled in settings
    if (!aiEnabled) {
      console.log("[AI Analysis] AI analysis disabled in settings");
      return {
        flowExplanation: "AI analysis disabled in settings",
        concerns: "Enable AI analysis in extension settings to get insights",
      };
    }

    if (!apiKey) {
      console.log(
        "[AI Analysis] No OpenAI API key found, skipping AI analysis"
      );
      return {
        flowExplanation: "AI analysis disabled - no API key configured",
        concerns:
          "Enable AI analysis by adding your OpenAI API key in settings",
      };
    }

    // Build the prompt with raw JSON
    const prompt = buildWorkflowAnalysisPrompt(workflowData);

    // Call OpenAI API
    console.log("[AI Analysis] Calling OpenAI API...");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-2025-04-14",
        messages: [
          {
            role: "system",
            content: `You are an expert GoHighLevel (GHL) workflow analyst with deep knowledge of marketing automation, CRM workflows, and sales processes. GoHighLevel is an all-in-one sales and marketing platform used by agencies and businesses to automate customer journeys, manage leads, send communications (SMS, email, voicemail), create opportunities, schedule appointments, and track conversions.

Your expertise includes:
- Understanding GHL workflow actions, triggers, and conditions
- Identifying automation best practices and anti-patterns
- Recognizing compliance risks (TCPA, GDPR, CAN-SPAM)
- Evaluating user experience and engagement strategies
- Spotting logic errors, performance issues, and missing error handling

Analyze workflows and provide clear, actionable insights that help users improve their automation.`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `OpenAI API error: ${errorData.error?.message || response.statusText}`
      );
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || "";

    console.log("[AI Analysis] AI analysis complete");

    // Parse the response to extract flow explanation and concerns
    const parsed = parseAIResponse(aiResponse);
    return parsed;
  } catch (error) {
    console.error("[AI Analysis] Error:", error);
    return {
      flowExplanation: "Error generating AI analysis",
      concerns: error.message,
    };
  }
}

/**
 * Build the prompt for AI analysis using raw workflow JSON
 */
function buildWorkflowAnalysisPrompt(workflowData) {
  // Stringify the entire workflow JSON
  const workflowJson = JSON.stringify(workflowData, null, 2);

  const prompt = `Analyze this GoHighLevel workflow JSON data and provide insights.

Here is the complete workflow data:

\`\`\`json
${workflowJson}
\`\`\`

Please analyze this workflow and provide:

1. **FLOW EXPLANATION** (2-3 sentences): Explain what this workflow does in simple terms, describing the journey a contact goes through from start to finish. Focus on the triggers, actions, conditions, and the overall purpose.

2. **POTENTIAL CONCERNS** (bullet points): Identify any potential issues, risks, or areas for improvement:
   - **Logic issues:** Missing conditions, infinite loops, dead ends, unclear branching logic
   - **User experience concerns:** Too many/few messages, poor timing, lack of engagement, confusing journey
   - **Compliance risks:** TCPA/SMS regulations, GDPR, CAN-SPAM, missing consent mechanisms
   - **Missing error handling:** No fallbacks for failed API calls, webhooks, or lookups
   - **Performance issues:** Heavy database queries, missing response handling, potential bottlenecks
   - **Best practice violations:** Not using engagement tools, missing tags, poor organization

Focus on actionable insights that will help improve the workflow.

Format your response EXACTLY as:

FLOW EXPLANATION:
[Your 2-3 sentence explanation here]

POTENTIAL CONCERNS:
- **Category:** Description of concern
- **Category:** Description of concern
- **Category:** Description of concern`;

  return prompt;
}

/**
 * Parse AI response to extract flow explanation and concerns
 */
function parseAIResponse(aiResponse) {
  let flowExplanation = "";
  let concerns = "";

  // Split response by sections
  const lines = aiResponse.split("\n");
  let currentSection = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.toUpperCase().includes("FLOW EXPLANATION")) {
      currentSection = "flow";
      continue;
    } else if (trimmed.toUpperCase().includes("POTENTIAL CONCERNS")) {
      currentSection = "concerns";
      continue;
    }

    if (currentSection === "flow" && trimmed) {
      flowExplanation += trimmed + " ";
    } else if (currentSection === "concerns" && trimmed) {
      concerns += trimmed + "\n";
    }
  }

  // Clean up
  flowExplanation = flowExplanation.trim();
  concerns = concerns.trim();

  // Fallback if parsing failed
  if (!flowExplanation && !concerns) {
    const parts = aiResponse.split(/POTENTIAL CONCERNS:|CONCERNS:/i);
    flowExplanation =
      parts[0]?.replace(/FLOW EXPLANATION:/i, "").trim() ||
      aiResponse.substring(0, 300);
    concerns = parts[1]?.trim() || "No specific concerns identified";
  }

  return {
    flowExplanation: flowExplanation || "No explanation generated",
    concerns: concerns || "No concerns identified",
  };
}
