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

        // highlight tabs that match Archive-It URLs
        if (tab.url.startsWith("https://wayback.archive-it.org/")) {
          option.style.backgroundColor = "lightgreen";
        }

        tabDropdown.appendChild(option);
      });
    });
  }

  // function to display leaks for the selected tab
  function displayLeaks(tabId) {
    const storageKey = `leakedURLs_${tabId}`;
    chrome.storage.local.get([storageKey], function (result) {
      const leakedUrls = result[storageKey] || [];
      leakLogContainer.innerHTML = "";

      // display URLs in the leaklog container
      if (leakedUrls.length > 0) {
        leakedUrls.forEach((url) => {
          const listItem = document.createElement("div");
          listItem.textContent = url;
          listItem.classList.add("leak-item");
          leakLogContainer.appendChild(listItem);
        });
      } else {
        leakLogContainer.textContent = "No leaks found for this tab.";
      }
    });
  }

  // event listener for the display leaks button
  displayLeaksButton.addEventListener("click", function () {
    const selectedTabId = tabDropdown.value;
    if (selectedTabId) {
      displayLeaks(parseInt(selectedTabId));
    } else {
      leakLogContainer.textContent = "Please select a tab.";
    }
  });

  // populate dropdown on page load
  populateTabDropdown();
});
