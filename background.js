let blockedURIsByTab = {}; // global object to hold blocked URIs by tabId
let lastURLByTabId = {}; // global object to hold last URL by tabId
let isPopupOpen = false; // tracks state of logwindow.html
let attachedTabs = {}; // tracks which tabs have the debugger attached
let logStorage = {}; // stores console log messages by tabId
let isCSPRewriteEnabledByTab = {}; // tracks isCSPRewriteEnabled state by tabId and URL
let successfulLoadsByTab = {};
let failedLoadsByTab = {};
let failedLoadCounts = {};
let leakCountsByTab = {}; // global object to track leak counts by tabId
let leakedURLsByTab = {}; // global object to store leaked URLs by tabId
let processedUrlsByTab = {}; // tracks processed URLs to prevent duplicate leaks
let currentTabId = null; // tracks the active tab ID for leak detection
let validTabActive = false; // tracks if the current tab is a valid Archive-It tab

// prefixes globally for reuse
const prefixes = [
  "https://wayback.archive-it.org/",
  "https://partner.archive-it.org/",
  "https://archive-it.org/",
];

// web request listener function for leak detection
function webRequestListenerFunction(details) {
  if (
    validTabActive &&
    details.tabId === currentTabId &&
    !prefixes.some((prefix) => details.url.startsWith(prefix))
  ) {
    // ensure processedUrlsByTab[details.tabId] is initialized as a Set
    processedUrlsByTab[details.tabId] =
      processedUrlsByTab[details.tabId] || new Set();

    if (!processedUrlsByTab[details.tabId].has(details.url)) {
      processedUrlsByTab[details.tabId].add(details.url);
      saveProcessedUrls(details.tabId);
      updateLeakCount(details.tabId, 1);
      console.log("Leak detected:", details.url);

      // save the leak URL for the current tab
      leakedURLsByTab[details.tabId] =
        leakedURLsByTab[details.tabId] || new Set();
      leakedURLsByTab[details.tabId].add(details.url);

      // store leak details in local storage
      chrome.storage.local.set({
        [`leakedURLs_${details.tabId}`]: Array.from(
          leakedURLsByTab[details.tabId]
        ),
      });
    }
  }
}

// update the leak count for a specific tab
function updateLeakCount(tabId, increment = 1) {
  leakCountsByTab[tabId] = (leakCountsByTab[tabId] || 0) + increment;

  // save the updated leak count in local storage
  chrome.storage.local.set(
    { [`leakCount_${tabId}`]: leakCountsByTab[tabId] },
    () => {
      console.log(
        `Updated leak count for tab ${tabId}: ${leakCountsByTab[tabId]}`
      );
      updateBadgeForActiveTab();
    }
  );
}

// save processed URLs to local storage for a specific tab
function saveProcessedUrls(tabId) {
  const processedUrls = Array.from(processedUrlsByTab[tabId] || []);
  chrome.storage.local.set(
    { [`processedUrls_${tabId}`]: processedUrls },
    () => {
      console.log(`Processed URLs saved for tab ${tabId}`);
    }
  );
}

// // badge update to show leak counts
// function updateBadgeForActiveTab() {
//   chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//     if (tabs.length > 0) {
//       const activeTabId = tabs[0].id;
//       const leakCount = leakCountsByTab[activeTabId] || 0;
//       chrome.action.setBadgeText({
//         text: leakCount > 0 ? `${leakCount}` : "",
//         tabId: activeTabId,
//       });
//     }
//   });
// }

// reset leaks and processed URLs when a tab is removed
chrome.tabs.onRemoved.addListener((tabId) => {
  delete leakCountsByTab[tabId];
  delete leakedURLsByTab[tabId];
  delete processedUrlsByTab[tabId]; // clear only the specific tab's processed URLs
  chrome.storage.local.remove([
    `leakCount_${tabId}`,
    `leakedURLs_${tabId}`,
    `processedUrls_${tabId}`,
  ]);
  console.log(`Tab ${tabId} removed, leak data cleared.`);
});

// listener for web requests to detect leaks
chrome.webRequest.onBeforeRequest.addListener(webRequestListenerFunction, {
  urls: ["<all_urls>"],
});

// track the active tab and check if it’s valid for leak detection
chrome.tabs.onActivated.addListener((activeInfo) => {
  currentTabId = activeInfo.tabId;
  chrome.tabs.get(currentTabId, (tab) => {
    validTabActive =
      tab && prefixes.some((prefix) => tab.url.startsWith(prefix));
    updateBadgeForActiveTab();
  });
});

// listener to retrieve resource leaks for a specific tab
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getResourceLeaks") {
    const tabId = message.tabId;
    console.log(`Received request for resource leaks of Tab ${tabId}`);

    const leakCount = leakCountsByTab[tabId] || 0;
    const leakedURLs = leakedURLsByTab[tabId]
      ? Array.from(leakedURLsByTab[tabId])
      : [];

    console.log(`Leaked URLs for Tab ${tabId}:`, leakedURLs);

    sendResponse({
      status: "success",
      tabId: tabId,
      leakCount: leakCount,
      leakedURLs: leakedURLs,
    });
    return true; // keeps message channel open for async response
  }
});

// update badge text with the current CSP violation
function updateBadgeForActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const activeTabId = tabs[0].id;

      // retrieve both leak count and CSP violation count
      Promise.all([
        getLeakCount(activeTabId),
        getCSPViolationCount(activeTabId),
      ]).then(([leakCount, blockedCount]) => {
        // combine counts into "leaks / violations"
        const badgeText = `${leakCount}/${blockedCount}`;

        // set badge text
        chrome.action.setBadgeText({
          text: leakCount > 0 || blockedCount > 0 ? badgeText : "",
          tabId: activeTabId,
        });

        // set color of badge background
        chrome.action.setBadgeBackgroundColor({
          color: leakCount > 0 || blockedCount > 0 ? "red" : "green",
          tabId: activeTabId,
        });
      });
    }
  });
}

// get leak count
function getLeakCount(tabId) {
  return new Promise((resolve) => {
    chrome.storage.local.get([`leakCount_${tabId}`], (result) => {
      resolve(result[`leakCount_${tabId}`] || 0); // default to 0 if not found
    });
  });
}

// get CSP violation count
function getCSPViolationCount(tabId) {
  return new Promise((resolve) => {
    chrome.storage.local.get([`blockedCount_${tabId}`], (result) => {
      resolve(result[`blockedCount_${tabId}`] || 0); // default to 0 if not found
    });
  });
}

// utility function to save console  logs
function saveLogs(tabId, logEntry) {
  chrome.storage.local.get([`logs_${tabId}`], (result) => {
    const logs = result[`logs_${tabId}`] || [];
    logs.push(logEntry);
    chrome.storage.local.set({ [`logs_${tabId}`]: logs }, () => {
      console.log(`Logs saved for tab ${tabId}`);
    });
  });
}

// main message listener for handling CSP violations, load failures, and logs
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : null;

  if (message.type === "cspViolation") {
    handleCspViolation(message, tabId, sendResponse);
  } else if (message.type === "loadFailed") {
    handleLoadFailed(message, tabId, sendResponse);
  } else if (message.type === "loadSuccessful") {
    handleLoadSuccessful(message, tabId, sendResponse);
  } else if (message.action === "attachDebugger") {
    attachDebugger(message, sendResponse);
  } else if (message.action === "popupOpened") {
    isPopupOpen = true;
    console.log("Popup opened");
  } else if (message.action === "popupClosed") {
    isPopupOpen = false;
    console.log("Popup closed");
  } else if (message.action === "getLogs") {
    getLogsForTab(message, sendResponse);
  }
  return true; // keep message channel open for asynchronous responses
});

// handle CSP violations
function handleCspViolation(message, tabId, sendResponse) {
  const { blockedURI } = message.details;

  if (tabId && blockedURI) {
    blockedURIsByTab[tabId] = blockedURIsByTab[tabId] || new Set();
    blockedURIsByTab[tabId].add(blockedURI);

    const blockedCount = blockedURIsByTab[tabId].size;
    chrome.storage.local.set(
      { [`blockedCount_${tabId}`]: blockedCount },
      () => {
        if (chrome.runtime.lastError) {
          console.error(`Storage error: ${chrome.runtime.lastError.message}`);
          sendResponse({
            status: "error",
            message: "Failed to store blocked URIs count.",
          });
        } else {
          console.log(
            `Saved blocked URIs count for tab ${tabId}: ${blockedCount}`
          );

          // update badge text for the current active tab
          updateBadgeForActiveTab();
          sendResponse({ status: "success", tabId, blockedCount });
        }
      }
    );
  } else {
    console.error("Error: No blockedURI or tabId provided.");
    sendResponse({
      status: "error",
      message: "No blockedURI or tabId provided.",
    });
  }
}

// handle load successful
function handleLoadSuccessful(message, tabId, sendResponse) {
  const { resourceType, resourceURL, status, originalURL } = message;

  console.log(`Successfully loaded ${resourceType}: ${resourceURL}`);

  // initialize an array for this tabId if it doesn't exist
  successfulLoadsByTab[tabId] = successfulLoadsByTab[tabId] || [];

  // add the successful load details to the tab's array
  successfulLoadsByTab[tabId].push({
    resourceType,
    resourceURL,
    originalURL,
    status,
    timestamp: new Date().toISOString(),
  });

  // optionally save the updated global object back to Chrome storage for persistence
  chrome.storage.local.set({ successfulLoadsByTab }, () => {
    console.log(`Saved successful load for tab ${tabId}:`, {
      resourceType,
      resourceURL,
      originalURL,
      status,
    });

    // send confirmation response back to content script
    sendResponse({ status: "success", tabId, resourceURL });
  });
}

// handle load failures
function handleLoadFailed(message, tabId, sendResponse) {
  const { resourceType, resourceURL, error, originalURL } = message;

  console.log(
    `Failed to load ${resourceType} resource: ${resourceURL}. Error: ${error}`
  );

  // initialize the array if it doesn't exist
  failedLoadsByTab[tabId] = failedLoadsByTab[tabId] || [];
  failedLoadCounts[tabId] = (failedLoadCounts[tabId] || 0) + 1;

  // add failure details to the tab's array
  failedLoadsByTab[tabId].push({
    resourceType,
    resourceURL,
    originalURL,
    error,
    timestamp: new Date().toISOString(),
  });

  // save the updated global object back to Chrome storage for persistence
  chrome.storage.local.set({ failedLoadsByTab, failedLoadCounts }, () => {
    console.log(`Saved failed loads and count for tab ${tabId}:`, {
      resourceType,
      resourceURL,
      originalURL,
      error,
      failedCount: failedLoadCounts[tabId], // Log the updated count
    });

    // send a response back to the content script to confirm receipt
    sendResponse({ status: "received" });
  });
}

// attach debugger to the tab
function attachDebugger(request, sendResponse) {
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
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }

    attachedTabs[tabId] = true;
    chrome.debugger.sendCommand({ tabId }, "Log.enable");
    chrome.debugger.sendCommand({ tabId }, "Runtime.enable");

    chrome.debugger.onEvent.addListener((source, method, params) => {
      if (source.tabId === tabId) {
        let message = "";
        if (method === "Log.entryAdded") {
          message = `[${params.entry.level}] ${params.entry.text}`;
        } else if (method === "Runtime.consoleAPICalled") {
          message = `[${params.type}] ${params.args
            .map((arg) => arg.value)
            .join(" ")}`;
        }

        if (message) {
          console.log(`Tab ${tabId}: ${message}`);
          logStorage[tabId] = logStorage[tabId] || [];
          logStorage[tabId].push({ tabId, message });
          saveLogs(tabId, { tabId, message });

          if (isPopupOpen) {
            chrome.runtime.sendMessage({ tabId, log: { message } });
          }
        }
      }
    });

    sendResponse({ success: true });
  });
}

// get logs for the specified tab
function getLogsForTab(request, sendResponse) {
  const tabId = request.tabId;
  chrome.storage.local.get([`logs_${tabId}`], (result) => {
    sendResponse(result[`logs_${tabId}`] || []);
  });
}

// listen for tab activation to update the badge for the active tab
chrome.tabs.onActivated.addListener(updateBadgeForActiveTab);

// listen for tab updates (e.g., navigation) to reset badge if necessary
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    updateBadgeForActiveTab();
  }
});

// initial call to update the badge when the extension is loaded
updateBadgeForActiveTab();

// when tabs are created, do:
chrome.tabs.onCreated.addListener((tab) => {
  chrome.storage.local.set({ cspRewriteEnabled: false });
});

// when tabs are removed, do:
chrome.tabs.onRemoved.addListener((tabId) => {
  // check and detach debugger if attached
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
    delete attachedTabs[tabId];
  }

  // clean up stored logs and blocked URIs for the tab
  delete logStorage[tabId];
  delete blockedURIsByTab[tabId];
  delete lastURLByTabId[tabId];
  delete isCSPRewriteEnabledByTab[tabId];
  delete successfulLoadsByTab[tabId];
  delete failedLoadsByTab[tabId];
  delete failedLoadCounts[tabId];

  // clear any local storage entries tied to the tab
  chrome.storage.local.remove(
    [`logs_${tabId}`, `blockedCount_${tabId}`],
    () => {
      if (chrome.runtime.lastError) {
        console.error(
          `Error clearing storage for tab ${tabId}: ${chrome.runtime.lastError.message}`
        );
      } else {
        console.log(`Storage cleared for tab ${tabId}`);
      }
    }
  );

  // reset CSP rewrite state for this tab
  chrome.storage.local.set({ [`cspRewriteEnabled_${tabId}`]: false }, () => {
    console.log(`CSP rewrite state reset for tab ${tabId}`);
  });

  console.log(`Tab ${tabId} removed, all associated data cleaned up.`);
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (removeInfo.isWindowClosing) return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0 && tabs[0].id === tabId) {
      // clear badge if the active tab with violations is closed
      chrome.action.setBadgeText({ text: "" });
    }
  });
});

// listens for incoming message and instructs logic in content.js
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "CSP_REWRITE_ENABLED") {
    console.log("CSP rewrite enabled");

    // send message to content script to enable CSP rewrite and reload the page
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "ENABLE_CSP_REWRITE" });
    });
  } else if (request.action === "CSP_REWRITE_DISABLED") {
    console.log("CSP rewrite disabled");

    // send message to content script to disable CSP rewrite and reload the page
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "DISABLE_CSP_REWRITE" });
    });
  }
});

// listens for navigation events to reset CSP violation count and clear blocked URIs
chrome.webNavigation.onCommitted.addListener(function (details) {
  const tabId = details.tabId;
  const newURL = details.url;

  // check if the new URL is from a different domain or a non-monitored site
  if (!newURL.startsWith("https://wayback.archive-it.org/")) {
    // reset the CSP violation count and clear blocked URIs for this tab
    chrome.storage.local.remove([`blockedCount_${tabId}`], () => {
      if (chrome.runtime.lastError) {
        console.error(
          `Error resetting blockedCount for tab ${tabId}: ${chrome.runtime.lastError.message}`
        );
      } else {
        console.log(`CSP violation count reset for tab ${tabId}`);
        blockedURIsByTab[tabId] = new Set(); // clear the in-memory blocked URIs
      }
    });
  }

  // optionally, update the last URL visited for this tab
  lastURLByTabId[tabId] = newURL;
});

// listener to get CSP violations for the selected tab
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getCSPViolations") {
    const tabId = message.tabId;
    console.log(`Received request for CSP violations of Tab ${tabId}`);

    chrome.storage.local.get([`blockedCount_${tabId}`], (result) => {
      const blockedCount = result[`blockedCount_${tabId}`] || 0;
      const blockedURIs = blockedURIsByTab[tabId]
        ? Array.from(blockedURIsByTab[tabId])
        : [];

      console.log(`Blocked URIs for Tab ${tabId}:`, blockedURIs);

      sendResponse({
        status: "success",
        tabId: tabId,
        blockedCount: blockedCount,
        blockedURIs: blockedURIs,
      });
    });

    return true; // keeps message channel open for async response
  }
});
