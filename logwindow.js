document.addEventListener("DOMContentLoaded", () => {
  const logDiv = document.getElementById("log", "log2");
  let activeTabId = null;

  // create and append log entries
  const appendLogEntry = (log) => {
    const logEntry = document.createElement("div");
    logEntry.textContent = log.message;

    // apply red color to "error"
    if (log.message.toLowerCase().includes("error")) {
      logEntry.style.color = "red";
    }
    // apply yellow color to "warning" messages
    else if (log.message.toLowerCase().includes("warning")) {
      logEntry.style.color = "orange";
    }

    logDiv.appendChild(logEntry);

    // add line break after each log entry
    const lineBreak = document.createElement("br");
    logDiv.appendChild(lineBreak);
  };

  // request logs of active tab from background.js
  const requestLogs = () => {
    chrome.runtime.sendMessage(
      { action: "getLogs", tabId: activeTabId },
      (response) => {
        logDiv.innerHTML = ""; // clear existing log entries
        if (response) {
          response.forEach((log) => {
            appendLogEntry(log);
          });
        }
      }
    );
  };

  // listen for new log messages
  const messageListener = (message) => {
    if (message.tabId === activeTabId && message.log) {
      appendLogEntry(message.log);
    }
  };

  chrome.runtime.onMessage.addListener(messageListener);

  // listen for changes in the active tab
  const tabActivatedListener = (activeInfo) => {
    activeTabId = activeInfo.tabId;
    requestLogs();
  };

  chrome.tabs.onActivated.addListener(tabActivatedListener);

  // initialize by getting the current active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      activeTabId = tabs[0].id;
      requestLogs();
    }
  });
});
