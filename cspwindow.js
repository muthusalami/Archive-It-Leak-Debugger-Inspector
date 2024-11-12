document.addEventListener("DOMContentLoaded", () => {
  const tabDropdown3 = document.getElementById("tabDropdown3");
  const loadButton = document.getElementById("openTabButton3");
  const cspViolationsDiv = document.getElementById("csp-violations");
  const failedRewritesDiv = document.getElementById("failed-rewrites");
  const successfulRewritesDiv = document.getElementById("successful-rewrites");
  let activeTab = "csp-violations"; // default active tab

  // populate the dropdown with available tabs
  const populateTabDropdown = () => {
    chrome.tabs.query({}, (tabs) => {
      console.log("Tabs fetched:", tabs);
      tabs.forEach((tab) => {
        const option = document.createElement("option");
        option.value = tab.id;
        option.textContent = `Tab ${tab.id}: ${tab.title}`;

        if (tab.url.startsWith("https://wayback.archive-it.org/")) {
          option.style.backgroundColor = "lightgreen";
        }
        tabDropdown3.appendChild(option);
      });
    });
  };

  // load and display CSP violations for the selected tab
  const loadCSPViolations = (tabId) => {
    chrome.runtime.sendMessage(
      { action: "getCSPViolations", tabId: parseInt(tabId) },
      (response) => {
        console.log("Response from background script:", response);

        cspViolationsDiv.innerHTML = `<h2>CSP Violations for Tab ${tabId}</h2>`;

        if (response && response.status === "success") {
          const blockedURIs = response.blockedURIs || [];

          if (blockedURIs.length > 0) {
            blockedURIs.forEach((uri) => {
              const logEntry = document.createElement("div");
              logEntry.className = "log-entry";
              logEntry.innerHTML = `${uri}`;
              cspViolationsDiv.appendChild(logEntry);
            });
          } else {
            cspViolationsDiv.innerHTML += `<p>No CSP violations found for Tab ${tabId}</p>`;
          }
        } else {
          cspViolationsDiv.innerHTML = `<p>Error loading CSP violations for Tab ${tabId}</p>`;
        }
      }
    );
  };

  // load and display failed rewrites for the selected tab
  const loadFailedRewrites = (tabId) => {
    chrome.storage.local.get({ failedLoadsByTab: {} }, (result) => {
      const failedLoadsByTab = result.failedLoadsByTab || {};
      const tabFailedLoads = failedLoadsByTab[tabId] || [];

      failedRewritesDiv.innerHTML = `<h2>Failed Rewrites for Tab ${tabId}</h2>`;

      if (tabFailedLoads.length > 0) {
        tabFailedLoads.forEach((failure) => {
          const logEntry = document.createElement("div");
          logEntry.className = "log-entry";
          logEntry.innerHTML = `
          <strong>Resource Type:</strong> ${failure.resourceType}<br>
          <strong>Original URL:</strong> ${failure.originalURL}<br>
          <strong>Resource URL:</strong> ${failure.resourceURL}<br>`;
          failedRewritesDiv.appendChild(logEntry);
        });
      } else {
        failedRewritesDiv.innerHTML += `<p>No failed rewrites found for Tab ${tabId}</p>`;
      }
    });
  };

  // load successful rewrites
  const loadSuccessfulRewrites = (tabId) => {
    chrome.storage.local.get({ successfulLoadsByTab: {} }, (result) => {
      const successfulLoadsByTab = result.successfulLoadsByTab || {};
      const tabSuccessfulLoads = successfulLoadsByTab[tabId] || []; // get the array of successful loads for this tab

      successfulRewritesDiv.innerHTML = `<h2>Successful Rewrites for Tab ${tabId}</h2>`;

      if (tabSuccessfulLoads.length > 0) {
        tabSuccessfulLoads.forEach((success) => {
          const logEntry = document.createElement("div");
          logEntry.className = "log-entry";
          logEntry.innerHTML = `
          <strong>Resource Type:</strong> ${success.resourceType}<br>
          <strong>Original URL:</strong> ${success.originalURL}<br>
          <strong>Resource URL:</strong> ${success.resourceURL}<br>`;
          successfulRewritesDiv.appendChild(logEntry);
        });
      } else {
        successfulRewritesDiv.innerHTML += `<p>No successful rewrites found for Tab ${tabId}</p>`;
      }
    });
  };

  // handle the "Load" button click
  loadButton.addEventListener("click", () => {
    const selectedTabId = tabDropdown3.value;
    if (selectedTabId) {
      // Load data based on the active tab
      if (activeTab === "csp-violations") {
        loadCSPViolations(selectedTabId);
      } else if (activeTab === "failed-rewrites") {
        loadFailedRewrites(selectedTabId);
      } else if (activeTab === "successful-rewrites") {
        loadSuccessfulRewrites(selectedTabId);
      }
    } else {
      alert("Please select a tab.");
    }
  });

  // populate the dropdown on DOM load
  populateTabDropdown();

  // function to switch between tabs
  const openTab = (tabName) => {
    const tabcontent = document.querySelectorAll(".tab-content");
    tabcontent.forEach((tab) => (tab.style.display = "none")); // hide all tab contents

    const activeTabContent = document.getElementById(tabName);
    if (activeTabContent) {
      activeTabContent.style.display = "block"; // display selected tab content
    }

    // update the active tab
    activeTab = tabName;
  };

  // add click event listeners to each tab link
  const tablinks = document.querySelectorAll(".tab-link");
  tablinks.forEach((link) => {
    link.addEventListener("click", function () {
      const tabName = this.getAttribute("data-tab"); // get data-tab attribute
      openTab(tabName); // open the corresponding tab

      // remove active class from all tabs and add it to the clicked tab
      tablinks.forEach((link) => link.classList.remove("active"));
      this.classList.add("active");
    });
  });

  // activate the CSP Violations tab by default on page load
  const cspButton = document.querySelector("[data-tab='csp-violations']");
  if (cspButton) {
    cspButton.classList.add("active"); // add the active class
    openTab("csp-violations"); // open the CSP Violations tab
  }
});
