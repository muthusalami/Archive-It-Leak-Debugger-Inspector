document.addEventListener("DOMContentLoaded", function () {
  const tabDropdown = document.getElementById("tabDropdown3");
  const displayLeaksButton = document.getElementById("openTabButton3");
  const leakLogContainer = document.getElementById("leaklog");

  // populate the dropdown with open tabs
  function populateTabDropdown() {
    chrome.tabs.query({}, function (tabs) {
      tabs.forEach((tab) => {
        const option = document.createElement("option");
        option.value = tab.id;
        option.textContent = `Tab ${tab.id}: ${tab.title}`;
        tabDropdown.appendChild(option);
      });
    });
  }

  // function to display the processed URLs for the selected tab
  function displayProcessedUrls(tabId) {
    const storageKey = `processedUrls_${tabId}`;
    chrome.storage.local.get([storageKey], function (result) {
      const processedUrls = result[storageKey] || [];
      leakLogContainer.innerHTML = "";

      // display URLs in the leaklog container
      if (processedUrls.length > 0) {
        processedUrls.forEach((url) => {
          const listItem = document.createElement("div");
          listItem.textContent = url;
          leakLogContainer.appendChild(listItem);
        });
      } else {
        leakLogContainer.textContent = "No processed URLs found for this tab.";
      }
    });
  }

  // event listener for the display leaks button
  displayLeaksButton.addEventListener("click", function () {
    const selectedTabId = tabDropdown.value;
    if (selectedTabId) {
      displayProcessedUrls(parseInt(selectedTabId));
    } else {
      leakLogContainer.textContent = "Please select a tab.";
    }
  });

  // populate dropdown on page load
  populateTabDropdown();
});
