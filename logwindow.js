document.addEventListener("DOMContentLoaded", () => {
  const logDiv1 = document.getElementById("log");
  const logDiv2 = document.getElementById("log2");
  let activeTabId1 = null;
  let activeTabId2 = null;

  const tabDropdown1 = document.getElementById("tabDropdown1");
  const tabDropdown2 = document.getElementById("tabDropdown2");

  // notify the background script that the popup is open
  chrome.runtime.sendMessage({ action: "popupOpened" });

  // populate dropdowns with available tabs
  const populateTabDropdowns = () => {
    chrome.tabs.query({}, (tabs) => {
      console.log("Tabs fetched:", tabs); // Debugging
      tabs.forEach((tab) => {
        const option1 = document.createElement("option");
        const option2 = document.createElement("option");

        option1.value = tab.id;
        option1.textContent = `Tab ${tab.id}: ${tab.title}`;
        tabDropdown1.appendChild(option1);

        option2.value = tab.id;
        option2.textContent = `Tab ${tab.id}: ${tab.title}`;
        tabDropdown2.appendChild(option2);
      });
    });
  };

  // create and append log entries to the specified log div
  const appendLogEntry = (log, logDiv) => {
    const logEntry = document.createElement("div");
    logEntry.textContent = log.message;

    // red for "error" messages
    if (log.message.toLowerCase().includes("error")) {
      logEntry.style.color = "red";
    }
    // orange for "warning" messages
    else if (log.message.toLowerCase().includes("warning")) {
      logEntry.style.color = "orange";
    }

    logDiv.appendChild(logEntry);

    // line break after each log entry
    const lineBreak = document.createElement("br");
    logDiv.appendChild(lineBreak);
  };

  // request logs of the selected tab from background.js
  const requestLogs = (tabId, logDiv) => {
    console.log(`Requesting logs for tab ${tabId}`);
    chrome.runtime.sendMessage(
      { action: "getLogs", tabId },
      (response = { messages: [] }) => {
        console.log("Logs received:", response);
        logDiv.innerHTML = "";

        // append logs if there are any messages
        if (Array.isArray(response.messages) && response.messages.length > 0) {
          response.messages.forEach((log) => {
            appendLogEntry(log, logDiv);
          });
        }
      }
    );
  };

  // handle the "Load Console Logs" button click for tab 1
  document.getElementById("openTabButton1").addEventListener("click", () => {
    activeTabId1 = parseInt(tabDropdown1.value, 10);
    console.log(`Selected tab for logDiv1: ${activeTabId1}`); // Debugging

    // sends message to background script to attach debugger
    chrome.runtime.sendMessage(
      { action: "attachDebugger", tabId: activeTabId1 },
      (response) => {
        if (response.success) {
          console.log(`Debugger attached to tab ${activeTabId1}`);

          // refresh selected tab
          chrome.tabs.reload(activeTabId1, () => {
            console.log(`Tab ${activeTabId1} refreshed`);
            requestLogs(activeTabId1, logDiv1); // fetch logs after tab refresh
          });
        } else {
          console.warn(`Failed to attach debugger: ${response.error}`);
        }
      }
    );
  });

  // handle the "Load Console Logs" button click for tab 2
  document.getElementById("openTabButton2").addEventListener("click", () => {
    activeTabId2 = parseInt(tabDropdown2.value, 10);
    console.log(`Selected tab for logDiv2: ${activeTabId2}`);

    // sends message to background script to attach debugger
    chrome.runtime.sendMessage(
      { action: "attachDebugger", tabId: activeTabId2 },
      (response) => {
        if (response.success) {
          console.log(`Debugger attached to tab ${activeTabId2}`);

          // refresh selected tab
          chrome.tabs.reload(activeTabId2, () => {
            console.log(`Tab ${activeTabId2} refreshed`);
            requestLogs(activeTabId2, logDiv2); // fetch logs after tab refresh
          });
        } else {
          console.warn(`Failed to attach debugger: ${response.error}`);
        }
      }
    );
  });

  // listens for new log messages from the background script
  chrome.runtime.onMessage.addListener((message) => {
    console.log("Message received:", message);
    if (message.tabId === activeTabId1 && message.log) {
      appendLogEntry(message.log, logDiv1);
    } else if (message.tabId === activeTabId2 && message.log) {
      appendLogEntry(message.log, logDiv2);
    }
  });

  // notifies background script when the popup is closed
  window.addEventListener("unload", () => {
    chrome.runtime.sendMessage({ action: "popupClosed" });
  });

  // populate dropdowns upon initialization
  populateTabDropdowns();
});
