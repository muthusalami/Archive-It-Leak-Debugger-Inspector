console.log("Service worker is running.");

let validTabActive = false;
const processedUrls = new Set();
let currentTabId = null;
let currentTabUrl = null;
let webRequestListener = null;

// initialize storage
chrome.storage.local.get(["processedUrls"], (result) => {
  const storedUrls = result.processedUrls || [];
  storedUrls.forEach((url) => processedUrls.add(url));
  console.log("Initialized storage:", { processedUrls });
});

// initialize badge with leak count
function initializeBadge(tabId) {
  if (tabId !== null) {
    chrome.storage.local.get([`leakCount_${tabId}`], (result) => {
      const initialLeakCount = result[`leakCount_${tabId}`] || 0;
      chrome.action.setBadgeText({ text: initialLeakCount.toString() });
    });
  }
}

// listen for changes in storage to update the badge
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (currentTabId !== null && changes[`leakCount_${currentTabId}`]) {
    const newValue = changes[`leakCount_${currentTabId}`].newValue;
    if (newValue !== undefined && newValue !== null) {
      chrome.action.setBadgeText({
        text: newValue.toString(),
      });
    } else {
      chrome.action.setBadgeText({ text: "0" });
    }
  }
});

// update the leak count for a tab
function updateLeakCount(tabId, increment = 0) {
  if (tabId !== null) {
    chrome.storage.local.get([`leakCount_${tabId}`], (result) => {
      const leakCount = (result[`leakCount_${tabId}`] || 0) + increment;
      chrome.storage.local.set({ [`leakCount_${tabId}`]: leakCount }, () => {
        console.log(`[Tab ID:${tabId}] Leak count total: ${leakCount}`);
        if (tabId === currentTabId) {
          chrome.action.setBadgeText({ text: leakCount.toString() });
        }
      });
    });
  }
}

// reset the leak count for a tab
function resetLeakCount(tabId) {
  if (tabId !== null) {
    chrome.storage.local.set({ [`leakCount_${tabId}`]: 0 }, () => {
      console.log(`[Tab ID:${tabId}] Leak count reset to 0`);
      if (tabId === currentTabId) {
        chrome.action.setBadgeText({ text: "0" });
      }
    });
  }
}

// save processed URLs to storage
function saveProcessedUrls() {
  chrome.storage.local.set({ processedUrls: Array.from(processedUrls) }, () => {
    console.log("Processed network requests saved to storage");
  });
}

// handle web requests to detect leaks
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
    updateLeakCount(currentTabId, 1); // update leak count for the current tab
    console.log(
      "Leak detected:",
      details.url,
      "Total leaks for this tab:",
      details.tabId
    );
  }
}

// manage web request listener
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

// get current active tab
function getCurrentTab() {
  const queryOptions = { active: true, currentWindow: true };
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
        validTabActive = tab.url.startsWith("https://wayback.archive-it.org/");
        if (!validTabActive) {
          console.log(
            tab.url === "chrome://newtab/"
              ? "No URL. Please enter a valid Archive-It URL."
              : "Not a valid Archive-It URL."
          );
        } else {
          console.log("Valid Archive-It URL. Checking for leaks...");
        }
        // update leak count for the new tab
        initializeBadge(tab.id);
      }
    } else {
      validTabActive = false;
    }
  });
}

// listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    // reset the processed URLs set when the URL changes
    processedUrls.clear();
    saveProcessedUrls();
    if (tab.url.startsWith("https://wayback.archive-it.org/")) {
      validTabActive = true;
      manageWebRequestListener(true);
    } else {
      validTabActive = false;
      manageWebRequestListener(false);
      resetLeakCount(tabId); // reset the leak count if navigating away from a valid URL
    }
  }
  if (changeInfo.status === "complete") {
    getCurrentTab();
  }
});

// listen for tab activation
chrome.tabs.onActivated.addListener((activeInfo) => {
  currentTabId = activeInfo.tabId;
  getCurrentTab();
});

// listen for window focus changes
chrome.windows.onFocusChanged.addListener(() => {
  getCurrentTab();
});

// add initial web request listener
manageWebRequestListener(true);

// initialize badge for the current tab on service worker startup
getCurrentTab();
