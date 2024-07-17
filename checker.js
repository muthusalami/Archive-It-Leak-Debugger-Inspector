$(function () {
  // use the Chrome Extensions API to get the current active tab's URL
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var activeTab = tabs[0];
    var currentUrl = activeTab.url;

    // display the URL in the input field
    $("#urlDisplay").val(currentUrl);
  });
});
