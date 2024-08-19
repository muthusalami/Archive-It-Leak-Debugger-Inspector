// leak count function
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

// launches logwindow.html
document.getElementById("openLogWindow").addEventListener("click", function () {
  chrome.windows.create({
    url: chrome.runtime.getURL("logwindow.html"),
    type: "popup",
    width: 2400,
    height: 1200,
  });
});
