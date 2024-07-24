$(function () {
  // chrome extensions API to get the current active tab's URL
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var activeTab = tabs[0];
    var currentUrl = activeTab.url;

    // display the URL in the input field
    $("#urlDisplay").val(currentUrl);
  });
});

$(function () {
  chrome.storage.local.get("leakCount", function (result) {
    var leakCount = result.leakCount || 0;
    console.log("Leak count retrieved from storage:", leakCount);

    // updates span element with the retrieved leak count
    $("#total").text(leakCount);
  });
});
