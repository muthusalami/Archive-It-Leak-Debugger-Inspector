$(function () {
  // chrome extensions API to get the current active tab's URL
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var activeTab = tabs[0];
    var currentUrl = activeTab.url;

    // display the URL in the input field
    $("#urlDisplay").val(currentUrl);
  });
});

$(document).ready(function () {
  function updateLeakCountDisplay() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs.length > 0) {
        let tab = tabs[0];
        let tabId = tab.id;

        chrome.storage.local.get([`leakCount_${tabId}`], function (result) {
          let leakCount = result[`leakCount_${tabId}`] || 0;
          $("#total").text(leakCount);
        });
      }
    });
  }

  // update the display when the popup is opened
  updateLeakCountDisplay();

  // optionally, add an event listener for the "Get Snapshot" button
  $("#whatToCapture").click(function () {
    updateLeakCountDisplay();
  });
});

// opens logwindow.html
document.getElementById("openLogWindow").addEventListener("click", function () {
  chrome.windows.create({
    url: chrome.runtime.getURL("logwindow.html"),
    type: "popup",
    width: 800,
    height: 600,
  });
});
