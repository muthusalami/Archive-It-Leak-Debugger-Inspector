console.log("Service worker is running.");

let logs = {};
let validTabActive = false;
const processedUrls = new Set();
let currentTabId = null;
let currentTabUrl = null;
let webRequestListener = null;

// initialize storage and badge
function initialize() {
  chrome.storage.local.get(["processedUrls"], (result) => {
    const storedUrls = result.processedUrls || [];
    storedUrls.forEach((url) => processedUrls.add(url));
    console.log("Initialized storage:", { processedUrls });
  });
  getCurrentTab();
}

// set the badge text
function setBadgeText(tabId, text) {
  if (tabId !== null) {
    chrome.action.setBadgeText({ text });
  }
}

// initialize badge with leak count
function initializeBadge(tabId) {
  if (tabId !== null) {
    chrome.storage.local.get([`leakCount_${tabId}`], (result) => {
      const initialLeakCount = result[`leakCount_${tabId}`] || 0;
      setBadgeText(tabId, initialLeakCount.toString());
    });
  }
}

// listen for storage changes to update the badge
chrome.storage.onChanged.addListener((changes) => {
  if (currentTabId !== null && changes[`leakCount_${currentTabId}`]) {
    const newValue = changes[`leakCount_${currentTabId}`].newValue || 0;
    setBadgeText(currentTabId, newValue.toString());
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
          setBadgeText(tabId, leakCount.toString());
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
        setBadgeText(tabId, "0");
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
    processedUrls.clear();
    saveProcessedUrls();
    validTabActive = tab.url.startsWith("https://wayback.archive-it.org/");
    manageWebRequestListener(validTabActive);
    if (!validTabActive) {
      resetLeakCount(tabId);
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
initialize();

// attach debugger when the tab is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    logs[tabId] = [];
  }

  if (changeInfo.status === "complete") {
    chrome.debugger.attach({ tabId }, "1.3", () => {
      if (chrome.runtime.lastError) {
        console.warn(
          `Failed to attach debugger to tab ${tabId}: ${chrome.runtime.lastError.message}`
        );
        return;
      }

      chrome.debugger.sendCommand({ tabId }, "Log.enable");
      chrome.debugger.sendCommand({ tabId }, "Runtime.enable");

      chrome.debugger.onEvent.addListener((source, method, params) => {
        let message;
        if (method === "Log.entryAdded") {
          message = `[${params.entry.level}] ${params.entry.text}`;
        } else if (method === "Runtime.consoleAPICalled") {
          message = `[${params.type}] ${params.args
            .map((arg) => arg.value)
            .join(" ")}`;
        }

        if (message) {
          console.log(`Tab ${tabId}: ${message}`);
          if (!logs[tabId]) {
            logs[tabId] = [];
          }
          logs[tabId].push({ tabId, message });

          // send the log message to the content script
          chrome.tabs.sendMessage(
            tabId,
            { tabId, log: { message } },
            (response) => {
              if (chrome.runtime.lastError) {
                console.warn(
                  `Failed to send message to tab ${tabId}: ${chrome.runtime.lastError.message}`
                );
              }
            }
          );
        }
      });
    });
  }
});

// handle messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getLogs") {
    const tabId = request.tabId;
    sendResponse(logs[tabId] || []);
  }
});

// detach debugger when the tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.debugger.detach({ tabId }, () => {
    if (chrome.runtime.lastError) {
      console.warn(
        `Failed to detach debugger from tab ${tabId}: ${chrome.runtime.lastError.message}`
      );
    } else {
      console.log(`Debugger detached from tab ${tabId}`);
    }
  });
  delete logs[tabId];
  console.log(`Tab ${tabId} closed and logs cleaned up`);
});
