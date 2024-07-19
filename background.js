console.log("Service worker is running.");

let leakCount = 0;

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    const waybackPrefix = "https://wayback.archive-it.org/";
    if (!details.url.startsWith(waybackPrefix)) {
      leakCount++;
      console.log("Leak detected:", details.url, "Total leaks:", leakCount);
    }
  },
  { urls: ["<all_urls>"] }
);
