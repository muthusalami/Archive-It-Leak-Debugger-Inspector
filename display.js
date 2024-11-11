// update and display leak count for the active tab
function updateLeakCount() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) return;

    const activeTabId = tabs[0].id;

    // send a message to background.js to get the leak count for the active tab
    chrome.runtime.sendMessage(
      { action: "getResourceLeaks", tabId: activeTabId },
      (response) => {
        if (response && response.status === "success") {
          // display the leak count in the popup
          document.getElementById("total").innerText = response.leakCount;
        } else {
          console.error("Failed to retrieve leak count.");
          document.getElementById("total").innerText = "Error";
        }
      }
    );
  });
}

// get active tab's ID and request the CSP violation count
function updateCSPViolationCount() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) return;

    const activeTabId = tabs[0].id;

    // send a message to background.js to get the CSP violation count for the active tab
    chrome.runtime.sendMessage(
      { action: "getCSPViolations", tabId: activeTabId },
      (response) => {
        if (response && response.status === "success") {
          // display the violation count in the popup
          document.getElementById("violationCount").innerText =
            response.blockedCount;
        } else {
          console.error("Failed to retrieve CSP violation count.");
          document.getElementById("violationCount").innerText = "Error";
        }
      }
    );
  });
}

// function to get current active tab's ID
function getActiveTab(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    callback(activeTab);
  });
}

// function to get CSP violations for a specific tabId
function getCSPViolations(tabId, callback) {
  const cspKey = `blockedCount_${tabId}`;
  chrome.storage.local.get([cspKey], (result) => {
    const cspViolations = result[cspKey] || 0; // default 0 if no violations are found
    callback(cspViolations);
  });
}

// function to display CSP violations in popup.html
function displayCSPViolations() {
  getActiveTab((tab) => {
    const tabId = tab.id;
    const tabUrl = tab.url;

    // display the tab URL in the popup
    console.log("Current Tab URL:", tabUrl);

    // get and display the number of CSP violations for current tab
    getCSPViolations(tabId, (cspViolations) => {
      document.getElementById("CSPtotal").textContent = cspViolations;
    });
  });
}

// function to handle CSP toggle switch state and updates
function handleToggleSwitch(toggleSwitch, currentTabId) {
  // load the current state of the toggle switch for this specific tab from chrome storage
  chrome.storage.local.get([`cspRewriteEnabled_${currentTabId}`], (result) => {
    toggleSwitch.checked = result[`cspRewriteEnabled_${currentTabId}`] || false;
  });

  // add event listener for when the toggle switch is changed
  toggleSwitch.addEventListener("change", function () {
    const isEnabled = toggleSwitch.checked;
    const action = isEnabled ? "CSP_REWRITE_ENABLED" : "CSP_REWRITE_DISABLED";

    console.log(
      `Toggle Switch is ${isEnabled ? "ON" : "OFF"} for Tab ID:`,
      currentTabId
    );

    // store the state in chrome storage for this specific tab
    chrome.storage.local.set(
      { [`cspRewriteEnabled_${currentTabId}`]: isEnabled },
      () => {
        console.log(
          `CSP rewrite ${
            isEnabled ? "enabled" : "disabled"
          } stored for tab ${currentTabId}`
        );
      }
    );

    // initiate or disable CSP rewrite logic
    chrome.runtime.sendMessage({
      action: action,
      tabId: currentTabId,
    });
  });

  // listen for reset event from the background script
  chrome.runtime.onMessage.addListener(function (
    message,
    sender,
    sendResponse
  ) {
    if (message.action === "CSP_RESET" && message.tabId === currentTabId) {
      // reset the toggle switch to false when a new page is loaded
      toggleSwitch.checked = false;
      console.log(
        `CSP rewrite toggle reset for tab ${currentTabId} due to navigation.`
      );
    }
  });
}

// function to initialize toggle switch
function initializeToggleSwitch() {
  const toggleSwitch = document.getElementById("toggleSwitch");
  getActiveTab((tab) => {
    const currentTabId = tab.id;
    handleToggleSwitch(toggleSwitch, currentTabId);
  });
}

// function to create a popup window
function createPopupWindow(url, width = 2400, height = 1200) {
  chrome.windows.create({
    url: chrome.runtime.getURL(url),
    type: "popup",
    width: width,
    height: height,
  });
}

// call the function to update the CSP violation count when the popup loads
document.addEventListener("DOMContentLoaded", () => {
  updateCSPViolationCount();
  updateLeakCount(); // New function to update the leak count
  displayCSPViolations();
  initializeToggleSwitch();
});

// event listeners for opening different popup windows
document.getElementById("openLeakWindow").addEventListener("click", () => {
  createPopupWindow("leakwindow.html");
});

document.getElementById("openLogWindow").addEventListener("click", () => {
  createPopupWindow("logwindow.html");
});

document.getElementById("openCspWindow").addEventListener("click", () => {
  createPopupWindow("cspwindow.html");
});
