console.log("Service worker is running.");

let leakCount = 0;
let validTabActive = false;
const processedUrls = new Set();
const activeTabs = new Set();
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
chrome.storage.local.get([`leakCount_${currentTabId}`], (result) => {
  let initialLeakCount = result[`leakCount_${currentTabId}`] || 0;
  chrome.action.setBadgeText({ text: initialLeakCount.toString() });
});

chrome.storage.onChanged.addListener(function (changes, areaName) {
  if (changes[`leakCount_${currentTabId}`]) {
    chrome.action.setBadgeText({
      text: changes[`leakCount_${currentTabId}`].newValue.toString(),
    });
  }
});

function updateLeakCount(tabId, increment = 0) {
  chrome.storage.local.get([`leakCount_${tabId}`], (result) => {
    leakCount = (result[`leakCount_${tabId}`] || 0) + increment;
    chrome.storage.local.set({ [`leakCount_${tabId}`]: leakCount }, () => {
      console.log(`[Tab ID:${tabId}] Leak count total: ${leakCount}`);
      chrome.action.setBadgeText({ text: leakCount.toString() });
    });
  });
}

function saveProcessedUrls() {
  chrome.storage.local.set({ processedUrls: Array.from(processedUrls) }, () => {
    console.log("Processed network requests saved to storage");
  });
}

function clearStorage() {
  leakCount = 0;
  processedUrls.clear();
  chrome.storage.local.clear(() => {
    console.log("Storage cleared.");
    chrome.action.setBadgeText({ text: "0" });
  });
}

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

function getCurrentTab() {
  let queryOptions = { active: true, lastFocusedWindow: true };
  chrome.tabs.query(queryOptions, (tabs) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }
    if (tabs.length > 0) {
      let tab = tabs[0];
      if (tab.id !== currentTabId || tab.url !== currentTabUrl) {
        currentTabId = tab.id;
        currentTabUrl = tab.url;
        console.log(
          `Window ID: ${tab.windowId}, Tab ID: ${tab.id}, Tab URL: ${tab.url}`
        );
        activeTabs.add(tab.id);
        validTabActive =
          tab.url && tab.url.startsWith("https://wayback.archive-it.org/");
        if (!validTabActive) {
          console.log(
            tab.url === "chrome://newtab/"
              ? "No URL. Please enter a valid Archive-It URL."
              : "Not a valid Archive-It URL."
          );
          // reset leak count when a valid tab goes to a non-valid URL
          updateLeakCount(tab.id, -leakCount);
        } else {
          console.log("Valid Archive-It URL. Checking for leaks...");
        }
        // update leak count for the new tab
        updateLeakCount(tab.id);
      }
    } else {
      validTabActive = false;
    }
  });
}

// clear storage when the tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeTabs.has(tabId)) {
    activeTabs.delete(tabId);
    if (activeTabs.size === 0) {
      clearStorage();
    }
  }
});

// listen for tab updates
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
    // reset leak count when a valid tab goes to a non-valid URL
    updateLeakCount(tabId, -leakCount);
  }
});

// listen for tab activation
chrome.tabs.onActivated.addListener(() => {
  getCurrentTab();
});

// add initial webRequest listener
manageWebRequestListener(true);
