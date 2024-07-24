console.log("Service worker is running...");

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

function saveToStorage() {
  chrome.storage.local.set(
    {
      leakCount,
      processedUrls: Array.from(processedUrls),
    },
    () => {
      console.log("Data saved to storage");
    }
  );
}

function checkAndSetupWebRequest(tabId, changeInfo, tab) {
  if (tab.url && tab.url.startsWith(waybackPrefix)) {
    console.log("Wayback URL valid.", tab.url);

    if (monitoredTabId !== tabId) {
      monitoredTabId = tabId;

      if (webRequestListener) {
        chrome.webRequest.onHeadersReceived.removeListener(webRequestListener);
      }

      webRequestListener = (details) => {
        if (
          !details.url.startsWith(waybackPrefix) &&
          !processedUrls.has(details.url)
        ) {
          processedUrls.add(details.url);
          leakCount++;
          console.log("Leak detected:", details.url, "Total leaks:", leakCount);
          saveToStorage();
        }
      };

      chrome.webRequest.onHeadersReceived.addListener(webRequestListener, {
        urls: ["<all_urls>"],
      });
    }
  } else {
    console.log("URL does not start with Wayback prefix:", tab.url);
  }
}

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
