document.getElementById("downloadLog").addEventListener("click", function () {
  chrome.runtime.sendMessage(
    { action: "downloadHAR", filename: "network.har" },
    function (response) {
      console.log("Download started, ID:", response.downloadId);
    }
  );
});
