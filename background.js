console.log("Service worker is running.");

let leakCount = 0;
let validTabActive = false;
const processedUrls = new Set();
const activeTabs = new Set();
let currentTabId = null;
let currentTabUrl = null;
let webRequestListener = null;

// Initialize storage
chrome.storage.local.get(["processedUrls"], (result) => {
  const storedUrls = result.processedUrls || [];
  storedUrls.forEach((url) => processedUrls.add(url));
  console.log("Initialized storage:", { processedUrls });
});

// Function to initialize badge with leak count
function initializeBadge(tabId) {
  if (tabId !== null) {
    chrome.storage.local.get([`leakCount_${tabId}`], (result) => {
      const initialLeakCount = result[`leakCount_${tabId}`] || 0;
      chrome.action.setBadgeText({ text: initialLeakCount.toString() });
    });
  }
}

// Initialize badge with leak count for the current tab
initializeBadge(currentTabId);

// Listen for changes in storage to update the badge
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (currentTabId !== null && changes[`leakCount_${currentTabId}`]) {
    const newValue = changes[`leakCount_${currentTabId}`].newValue;
    if (newValue !== undefined && newValue !== null) {
      chrome.action.setBadgeText({ text: newValue.toString() });
    } else {
      chrome.action.setBadgeText({ text: "0" });
    }
  }
});

// Update the leak count for a tab
function updateLeakCount(tabId, increment = 0) {
  if (tabId !== null) {
    chrome.storage.local.get([`leakCount_${tabId}`], (result) => {
      leakCount = (result[`leakCount_${tabId}`] || 0) + increment;
      chrome.storage.local.set({ [`leakCount_${tabId}`]: leakCount }, () => {
        console.log(`[Tab ID:${tabId}] Leak count total: ${leakCount}`);
        chrome.action.setBadgeText({ text: leakCount.toString() });
      });
    });
  }
}

// Reset the leak count for a tab
function resetLeakCount(tabId) {
  if (tabId !== null) {
    chrome.storage.local.set({ [`leakCount_${tabId}`]: 0 }, () => {
      console.log(`[Tab ID:${tabId}] Leak count reset to 0`);
      chrome.action.setBadgeText({ text: "0" });
    });
  }
}

// Save processed URLs to storage
function saveProcessedUrls() {
  chrome.storage.local.set({ processedUrls: Array.from(processedUrls) }, () => {
    console.log("Processed network requests saved to storage");
  });
}

// Clear storage
function clearStorage() {
  leakCount = 0;
  processedUrls.clear();
  chrome.storage.local.clear(() => {
    console.log("Storage cleared.");
    chrome.action.setBadgeText({ text: "0" });
  });
}

// Handle web requests to detect leaks
function webRequestListenerFunction(details) {
  const waybackPrefix = "https://wayback.archive-it.org/";
  if (
    validTabActive &&
    details.tabId === currentTabId &&
    !details.url.startsWith(waybackPrefix) &&
    !processedUrls.has(details.url)
  ) {
    processedUrls.add(details.url);
    saveProcessedUrls();
    updateLeakCount(currentTabId, 1);
    console.log(
      "Leak detected:",
      details.url,
      "Total leaks for this tab:",
      leakCount
    );
  }
}

// Manage web request listener
function manageWebRequestListener(add) {
  if (add && !webRequestListener) {
    webRequestListener = webRequestListenerFunction;
    chrome.webRequest.onHeadersReceived.addListener(
      webRequestListener,
      { urls: ["<all_urls>"] },
      ["responseHeaders"]
    );
  } else if (!add && webRequestListener) {
    chrome.webRequest.onHeadersReceived.removeListener(webRequestListener);
    console.log("WebRequest listener removed.");
    webRequestListener = null;
  }
}

// Get current active tab
function getCurrentTab() {
  const queryOptions = { active: true, lastFocusedWindow: true };
  chrome.tabs.query(queryOptions, (tabs) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }
    if (tabs.length > 0) {
      const tab = tabs[0];
      if (tab.id !== currentTabId || tab.url !== currentTabUrl) {
        currentTabId = tab.id;
        currentTabUrl = tab.url;
        console.log(
          `Window ID: ${tab.windowId}, Tab ID: ${tab.id}, Tab URL: ${tab.url}`
        );
        activeTabs.add(tab.id);
        validTabActive = tab.url.startsWith("https://wayback.archive-it.org/");
        if (!validTabActive) {
          console.log(
            tab.url === "chrome://newtab/"
              ? "No URL. Please enter a valid Archive-It URL."
              : "Not a valid Archive-It URL."
          );
          // Reset leak count when a valid tab goes to a non-valid URL
          resetLeakCount(tab.id);
        } else {
          console.log("Valid Archive-It URL. Checking for leaks...");
        }
        // Update leak count for the new tab
        updateLeakCount(tab.id);
      }
    } else {
      validTabActive = false;
    }
  });
}

// Clear storage when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeTabs.has(tabId)) {
    activeTabs.delete(tabId);
    if (activeTabs.size === 0) {
      clearStorage();
    }
  }
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "loading" &&
    tab.url.startsWith("https://wayback.archive-it.org/")
  ) {
    manageWebRequestListener(false);
    clearStorage();
    manageWebRequestListener(true);
    console.log("Tab refresh detected. Listener re-added and storage cleared.");
  }
  if (changeInfo.url || changeInfo.status === "complete") {
    getCurrentTab();
  }
  if (
    changeInfo.url &&
    !changeInfo.url.startsWith("https://wayback.archive-it.org/")
  ) {
    // Reset leak count when a valid tab goes to a non-valid URL
    resetLeakCount(tabId);
  }
});

// Listen for tab activation
chrome.tabs.onActivated.addListener(() => {
  getCurrentTab();
});

// Add initial web request listener
manageWebRequestListener(true);
