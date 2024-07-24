// checks service worker
console.log("Service worker is running...");

// variables
let leakCount = 0;
const waybackPrefix = "https://wayback.archive-it.org/";
const processedUrls = new Set();
let monitoredTabId = null;
let webRequestListener = null;

// initialize storage values
chrome.storage.local.get(["leakCount", "processedUrls"], (result) => {
  leakCount = result.leakCount || 0;
  const storedUrls = result.processedUrls || [];
  storedUrls.forEach((url) => processedUrls.add(url));
  console.log("Initialized storage:", { leakCount, processedUrls });
});

// saves leak count and processed network links locally
function saveToStorage() {
  chrome.storage.local.set(
    {
      leakCount,
      processedUrls: Array.from(processedUrls),
    },
    () => {
      console.log("Leak count saved to storage");
    }
  );
}

// checks for url in tab & for validity
// checks if tab is being monitored & updates accordingly
// removes previous listener to avoid duplicate listeners
// sets up new listener, checks tab, checks for leaks
// adds network link to processed urls and increments the leak count
function checkAndSetupWebRequest(tabId, changeInfo, tab) {
  if (tab.url && tab.url.startsWith(waybackPrefix)) {
    console.log("Wayback URL valid.", tab.url);

    if (monitoredTabId !== tabId) {
      monitoredTabId = tabId;

      if (webRequestListener) {
        chrome.webRequest.onHeadersReceived.removeListener(webRequestListener);
      }

      webRequestListener = (details) => {
        chrome.tabs.get(details.tabId, (requestTab) => {
          if (requestTab && requestTab.id === monitoredTabId) {
            if (
              !details.url.startsWith(waybackPrefix) &&
              !processedUrls.has(details.url)
            ) {
              processedUrls.add(details.url);
              leakCount++;
              console.log(
                "Leak detected:",
                details.url,
                "Total leaks:",
                leakCount,
                "Tab ID:",
                details.tabId
              );
              saveToStorage();
            }
          }
        });
      };

      chrome.webRequest.onHeadersReceived.addListener(
        webRequestListener,
        { urls: ["<all_urls>"] },
        ["responseHeaders"]
      );
    }
  } else if (!tab.url) {
    console.log("Tab URL is not valid:", tab.url);
  } else {
    console.log("URL does not start with Wayback prefix:", tab.url);
  }
}

// flushes local storage & resets leak count once monitored tab is closed
function clearProcessedUrls(tabId, removeInfo) {
  if (tabId === monitoredTabId) {
    console.log("Tab closed. Processed URLs cleared and monitoring stopped.");
    processedUrls.clear();
    console.log("Processed URLs after clearing:", processedUrls);
    leakCount = 0;
    console.log("Leak count reset to:", leakCount);

    // reset state
    saveToStorage();

    monitoredTabId = null;

    if (webRequestListener) {
      chrome.webRequest.onHeadersReceived.removeListener(webRequestListener);
      webRequestListener = null;
    }
  }
}

chrome.tabs.onUpdated.addListener(checkAndSetupWebRequest);
chrome.tabs.onRemoved.addListener(clearProcessedUrls);
