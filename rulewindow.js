document.addEventListener("DOMContentLoaded", function () {
  const tabDropdown = document.getElementById("tabDropdown4");
  const displayRulesButton = document.getElementById("openTabButton4");
  const ruleLogContainer = document.getElementById("rulelog");

  // Function to populate the dropdown with open tabs
  function populateTabDropdown() {
    chrome.tabs.query({}, function (tabs) {
      tabDropdown.innerHTML = ""; // Clear existing options

      tabs.forEach((tab) => {
        if (!tab.url) return; // Ignore tabs with no URL

        const option = document.createElement("option");
        option.value = tab.id;
        option.textContent = `Tab ${tab.id}: ${tab.title}`;

        // Highlight Archive-It URLs
        if (tab.url.startsWith("https://wayback.archive-it.org/")) {
          option.style.backgroundColor = "lightgreen";
        }

        tabDropdown.appendChild(option);
      });

      // Auto-select first tab if available
      if (tabs.length > 0) {
        tabDropdown.value = tabs[0].id;
      }
    });
  }

  // Function to fetch rules from the Django API
  async function fetchRules(url) {
    try {
      const surt = getReversedDomain(url);
      if (!surt) {
        throw new Error("SURT extraction failed.");
      }

      // Ensure commas are NOT URL-encoded
      const apiUrl = `http://127.0.0.1:8000/rules/for-request?surt=${surt}`;
      console.log(`Fetching rules from: ${apiUrl}`);

      const rulesResponse = await fetch(apiUrl);

      if (!rulesResponse.ok) {
        throw new Error(`Failed to fetch rules: ${rulesResponse.status}`);
      }

      const rulesData = await rulesResponse.json();

      if (rulesData.status !== "success" || !Array.isArray(rulesData.result)) {
        throw new Error("Invalid rules response format.");
      }

      return rulesData.result;
    } catch (error) {
      z;
      console.error("Error fetching rules:", error);
      return [];
    }
  }

  // Function to check the selected tab’s URL against rules
  async function checkTabAgainstRules(tabId) {
    try {
      chrome.tabs.get(parseInt(tabId), async (tab) => {
        if (!tab || !tab.url) {
          ruleLogContainer.textContent = "No valid URL detected for this tab.";
          return;
        }

        console.log(`Checking rules for tab: ${tab.id}, URL: ${tab.url}`);
        const rules = await fetchRules(tab.url);

        const matchedRules = rules.filter((rule) => rule.enabled);

        // Display matched rules
        if (matchedRules.length > 0) {
          ruleLogContainer.innerHTML = matchedRules
            .map(
              (rule) => `<div class="rule-card">
                <p><strong>Policy:</strong> ${rule.policy}</p>
                <p><strong>SURT:</strong> ${rule.surt}</p>
                <p><strong>Environment:</strong> ${rule.environment}</p>
                <p><strong>Enabled:</strong> ${rule.enabled ? "Yes" : "No"}</p>
            </div>`
            )
            .join(""); // Ensures a single-line HTML string
        } else {
          ruleLogContainer.textContent = "No rules matched this URL.";
        }
      });
    } catch (error) {
      console.error("Error checking tab against rules:", error);
      ruleLogContainer.textContent =
        "An error occurred. Please check your server.";
    }
  }

  // Function to reverse a domain into SURT-compatible format
  function getReversedDomain(url) {
    try {
      if (!url || typeof url !== "string" || url.trim() === "") {
        throw new Error("Invalid or missing URL input.");
      }

      console.log(`Original URL: ${url}`); // Debugging

      // Extract the actual archived domain from Wayback Machine URL
      const waybackMatch = url.match(
        /https?:\/\/wayback\.archive-it\.org\/\d+\/\d+\/(https?:\/\/[^\/]+)/
      );

      let domain;
      if (waybackMatch && waybackMatch[1]) {
        try {
          console.log(`Extracted from Wayback URL: ${waybackMatch[1]}`);
          domain = new URL(waybackMatch[1]).hostname;
        } catch (err) {
          console.error(
            "Failed to extract valid domain from Wayback URL:",
            err
          );
          return "";
        }
      } else {
        // If it's not a Wayback Machine URL, extract domain normally
        try {
          domain = new URL(url).hostname;
        } catch (err) {
          console.error("Invalid original URL:", err);
          return "";
        }
      }

      if (!domain || domain.trim() === "") {
        throw new Error("Could not extract a valid domain.");
      }

      // Convert domain to SURT format
      let parts = domain.split(".").reverse();

      // Ensure `,www` is **always** added if the domain does NOT already contain "www."
      if (!domain.startsWith("www.")) {
        parts.push("www");
      }

      // **Add `)/%` to match stored format**
      let surt = parts.join(",") + ")/%";

      console.log(`Final SURT: ${surt}`); // Debugging log

      return surt;
    } catch (error) {
      console.error("Error parsing domain:", error);
      return "";
    }
  }

  // Event listener for the display rules button
  displayRulesButton.addEventListener("click", function () {
    const selectedTabId = parseInt(tabDropdown.value);
    if (selectedTabId) {
      checkTabAgainstRules(selectedTabId);
    } else {
      ruleLogContainer.textContent = "Please select a tab.";
    }
  });

  // Populate dropdown on page load
  populateTabDropdown();
});

// Global storage for tracking resources & policies
let policiesByTab = {}; // { tabId: { tabUrl: string, resources: [{surt, url, policies}] } }

// Function to fetch all resources, convert to SURT, and check against rules engine
function getAndCheckResources(tabId, tabUrl) {
  chrome.debugger.attach({ tabId }, "1.3", () => {
    if (chrome.runtime.lastError) {
      console.warn(
        `Failed to attach debugger to tab ${tabId}: ${chrome.runtime.lastError.message}`
      );
      return;
    }

    chrome.debugger.sendCommand({ tabId }, "Network.enable", {}, () => {
      console.log(`Network debugging enabled for tab ${tabId}`);

      policiesByTab[tabId] = { tabUrl, resources: [] }; // Initialize storage for tab

      chrome.debugger.onEvent.addListener((source, method, params) => {
        if (source.tabId === tabId && method === "Network.responseReceived") {
          const resourceURL = params.response.url;
          const surtURL = convertToSURT(resourceURL);

          // Query local rules engine
          checkAgainstRulesEngine(surtURL, (result) => {
            if (result && result.status === "success") {
              const policies = result.result.map((r) => r.policy);
              console.log(`Policies for ${surtURL}:`, policies);

              // Store resource URL, SURT, and policies
              policiesByTab[tabId].resources.push({
                surt: surtURL,
                url: resourceURL,
                policies,
              });

              // Persist policies to storage
              chrome.storage.local.set({
                [`policiesByTab_${tabId}`]: policiesByTab[tabId],
              });
            }
          });
        }
      });

      // Stop listening when the page load completes
      chrome.debugger.sendCommand({ tabId }, "Network.disable", () => {
        console.log(`Network debugging disabled for tab ${tabId}`);
        chrome.debugger.detach({ tabId });
      });
    });
  });
}

// Convert URL to SURT format
function convertToSURT(url) {
  try {
    let parsedUrl = new URL(url);
    let hostname = parsedUrl.hostname.split(".").reverse().join(",");
    let path = parsedUrl.pathname + parsedUrl.search;
    return `(${hostname})${path}`;
  } catch (error) {
    console.error(`Error converting URL to SURT: ${url}`, error);
    return url;
  }
}

// Query local rules engine with SURT URL
function checkAgainstRulesEngine(surtURL, callback) {
  const apiUrl = `http://127.0.0.1:8000/rules/for-request?surt=${encodeURIComponent(
    surtURL
  )}`;

  fetch(apiUrl)
    .then((response) => response.json())
    .then((data) => {
      callback(data);
    })
    .catch((error) => {
      console.error(`Error fetching rules for ${surtURL}:`, error);
      callback(null);
    });
}

// Listen for completed page loads and check resources
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId === 0) {
    chrome.tabs.get(details.tabId, (tab) => {
      if (tab && tab.url) {
        console.log(`Page loaded in tab ${details.tabId}, checking resources.`);
        getAndCheckResources(details.tabId, tab.url);
      }
    });
  }
});

// Cleanup when a tab is removed
chrome.tabs.onRemoved.addListener((tabId) => {
  delete policiesByTab[tabId];
  chrome.storage.local.remove([`policiesByTab_${tabId}`]);
  console.log(`Tab ${tabId} removed, policy data cleared.`);
});
