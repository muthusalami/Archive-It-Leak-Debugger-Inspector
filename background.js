console.log("Service worker is running.");

let logs = {}; // in-memory logs for quick access
let attachedTabs = {}; // tracks attached tabs
let isPopupOpen = false; // tracks popup state
let validTabActive = false;
const processedUrls = new Set();
let currentTabId = null;
let currentTabUrl = null;
let webRequestListener = null;

// initialize storage and leak count badge
function initialize() {
  chrome.storage.local.get(["processedUrls"], (result) => {
    const storedUrls = result.processedUrls || [];
    storedUrls.forEach((url) => processedUrls.add(url));
    console.log("Initialized storage:", { processedUrls });
  });
  getCurrentTab();
}

// set badge text
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

// updates the leak count for a tab
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
function saveProcessedUrls(tabId) {
  chrome.storage.local.get([`processedUrls_${tabId}`], (result) => {
    const storedUrls = result[`processedUrls_${tabId}`] || [];
    const combinedUrls = new Set([...storedUrls, ...processedUrls]);
    chrome.storage.local.set(
      { [`processedUrls_${tabId}`]: Array.from(combinedUrls) },
      () => {
        console.log(`Processed URLs saved to storage for tab ${tabId}`);
      }
    );
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
    saveProcessedUrls(details.tabId);
    updateLeakCount(currentTabId, 1);
    console.log("Leak detected:", details.url);
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

          // loads processed URLs for tab from storage
          chrome.storage.local.get(
            [`processedUrls_${currentTabId}`],
            (result) => {
              processedUrls.clear();
              const storedUrls = result[`processedUrls_${currentTabId}`] || [];
              storedUrls.forEach((url) => processedUrls.add(url));
            }
          );
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
    processedUrls.clear(); // clears in-memory URL set
    chrome.storage.local.set({ [`processedUrls_${tabId}`]: [] }); // clears stored URLs for specific tab
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

// save logs to storage
function saveLogs(tabId, logData) {
  chrome.storage.local.get([`logs_${tabId}`], (result) => {
    const storedLogs = result[`logs_${tabId}`] || [];
    storedLogs.push(logData);
    chrome.storage.local.set({ [`logs_${tabId}`]: storedLogs });
  });
}

// attach debugger to a specific tab based on the user's selection
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "popupOpened") {
    isPopupOpen = true;
    console.log("Popup opened");
  } else if (request.action === "popupClosed") {
    isPopupOpen = false;
    console.log("Popup closed");
  } else if (request.action === "attachDebugger") {
    const tabId = request.tabId;

    if (attachedTabs[tabId]) {
      console.log(`Debugger already attached to tab ${tabId}`);
      sendResponse({ success: true });
      return;
    }

    chrome.debugger.attach({ tabId }, "1.3", () => {
      if (chrome.runtime.lastError) {
        console.warn(
          `Failed to attach debugger to tab ${tabId}: ${chrome.runtime.lastError.message}`
        );
        sendResponse({
          success: false,
          error: chrome.runtime.lastError.message,
        });
        return;
      }

      attachedTabs[tabId] = true; // mark the tab as attached

      chrome.debugger.sendCommand({ tabId }, "Log.enable");
      chrome.debugger.sendCommand({ tabId }, "Runtime.enable");

      // listen for debugger events and log messages
      chrome.debugger.onEvent.addListener((source, method, params) => {
        if (source.tabId === tabId) {
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
            saveLogs(tabId, { tabId, message }); // saves logs to storage

            // sends log message to the popup only if it's open
            if (isPopupOpen) {
              chrome.runtime.sendMessage(
                { tabId, log: { message } },
                (response) => {
                  if (chrome.runtime.lastError) {
                    console.warn(
                      `Failed to send message to popup: ${chrome.runtime.lastError.message}`
                    );
                  }
                }
              );
            }
          }
        }
      });

      sendResponse({ success: true });
    });

    return true; // keeps the message channel open for async response
  }
});

// handle messages to retrieve logs from storage
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getLogs") {
    const tabId = request.tabId;
    chrome.storage.local.get([`logs_${tabId}`], (result) => {
      sendResponse(result[`logs_${tabId}`] || []);
    });
    return true;
  }
});

// removes debugger when the tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (attachedTabs[tabId]) {
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
    delete attachedTabs[tabId]; // cleans up the attachedTabs object
    console.log(`Tab ${tabId} closed and logs cleaned up`);
  }
});
