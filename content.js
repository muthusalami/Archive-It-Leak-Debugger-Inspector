let isCSPRewriteEnabled = false; // track whether CSP rewrite is enabled

// load the toggle state from storage on page load
function loadToggleState() {
  chrome.storage.local.get(["cspRewriteEnabled"], (result) => {
    isCSPRewriteEnabled = result.cspRewriteEnabled || false;
    console.log(`CSP rewrite enabled: ${isCSPRewriteEnabled}`);

    // if rewrite is enabled, ask background.js for stored CSP violations and process them
    if (isCSPRewriteEnabled) {
      chrome.runtime.sendMessage({ action: "getCSPViolations" }, (response) => {
        if (response.status === "success" && response.violations) {
          processAllCSPViolations(response.violations); // process all stored violations
        }
      });
    }
  });
}

// listen for CSP violations and store the details in background.js
document.addEventListener("securitypolicyviolation", (event) => {
  if (window.location.href.startsWith("https://wayback.archive-it.org/")) {
    const violationDetails = {
      blockedURI: event.blockedURI || "Inline or eval resource",
      violatedDirective: event.violatedDirective,
      documentURI: event.documentURI,
    };

    console.log(
      "CSP violation detected:",
      violationDetails.blockedURI,
      violationDetails
    );

    // send CSP violation details to background.js for tracking
    sendMessageToBackground({
      type: "cspViolation",
      details: violationDetails,
    });

    // if CSP rewrite is enabled, process the violation immediately
    if (isCSPRewriteEnabled) {
      processBlockedResource(violationDetails);
    }
  }
});

// send message to background script with retries
function sendMessageToBackground(message, retries = 3) {
  chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError && retries > 0) {
      console.error(
        `Error sending message: ${chrome.runtime.lastError.message}. Retrying...`
      );
      setTimeout(() => sendMessageToBackground(message, retries - 1), 1000); // Retry after 1 second
    } else if (chrome.runtime.lastError) {
      console.error(
        `Failed to send message after retries: ${chrome.runtime.lastError.message}`
      );
    } else {
      console.log("Message sent successfully:", message);
    }
  });
}

// listen for messages from the background script to enable or disable CSP rewrite
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ENABLE_CSP_REWRITE") {
    console.log("CSP rewrite enabled");
    isCSPRewriteEnabled = true;
    chrome.storage.local.set({ cspRewriteEnabled: true }, () => {
      location.reload(); // reload the page to apply CSP rewrite logic
    });
  } else if (request.action === "DISABLE_CSP_REWRITE") {
    console.log("CSP rewrite disabled");
    isCSPRewriteEnabled = false;
    chrome.storage.local.set({ cspRewriteEnabled: false }, () => {
      location.reload(); // reload the page to disable CSP rewrite logic
    });
  } else if (request.action === "PROCESS_CSP_REWRITE") {
    // process violations passed from background.js when CSP rewrite is enabled
    request.violations.forEach((violation) => {
      processBlockedResource(violation);
    });
  }
});

// process all stored CSP violations (retrieved from background.js)
function processAllCSPViolations(violations) {
  violations.forEach((violation) => {
    processBlockedResource(violation);
  });
}

// process blocked resources and attempt to rewrite and reload them
function processBlockedResource(violationDetails) {
  const waybackURL = extractWaybackURL(window.location.href);
  const newURL = constructWaybackURL(waybackURL, violationDetails.blockedURI);

  if (violationDetails.blockedURI.includes(".js")) {
    loadResource("script", newURL, "src", violationDetails.blockedURI);
  } else if (violationDetails.blockedURI.includes(".css")) {
    loadResource("link", newURL, "href", violationDetails.blockedURI);
  } else if (violationDetails.blockedURI.match(/\.(jpg|png|gif)$/)) {
    replaceImageSource(violationDetails.blockedURI, newURL);
  }
}

// extract Wayback playback URL from the current tab's URL
function extractWaybackURL(tabURL) {
  const waybackPattern = /https:\/\/wayback.archive-it.org\/\d+\/\d+\//;
  const match = tabURL.match(waybackPattern);
  return match ? match[0] : null;
}

// construct new URL for the blocked resource
function constructWaybackURL(waybackBaseURL, blockedResourceURL) {
  if (waybackBaseURL) {
    return waybackBaseURL + blockedResourceURL.replace(/^https?:\/\//, "");
  }
  return blockedResourceURL;
}

// load and validate scripts or stylesheets, and log successes/failures
function loadResource(tagName, resourceURL, attribute, originalURL) {
  const element = document.createElement(tagName);
  element[attribute] = resourceURL;

  element.onload = () => {
    console.log(`${tagName} loaded successfully:`, resourceURL);

    // send successful load details to background.js
    sendMessageToBackground({
      type: "loadSuccessful",
      resourceType: tagName,
      originalURL: originalURL,
      resourceURL: resourceURL,
      status: "Resource loaded successfully after rewrite",
    });
  };

  element.onerror = () => {
    console.error(`Failed to load ${tagName}:`, resourceURL);

    // send failed load details to background.js
    sendMessageToBackground({
      type: "loadFailed",
      resourceType: tagName,
      originalURL: originalURL,
      resourceURL: resourceURL,
      error: "Failed to load resource after rewrite",
    });
  };

  if (tagName === "script") {
    document.head.appendChild(element);
  } else if (tagName === "link") {
    element.rel = "stylesheet";
    document.head.appendChild(element);
  }
}

// replace blocked image source with the Wayback URL, and log successes/failures
function replaceImageSource(blockedImageURL, newImageURL) {
  const blockedImg = document.querySelector(`img[src="${blockedImageURL}"]`);
  if (blockedImg) {
    blockedImg.src = newImageURL;

    blockedImg.onload = () => {
      console.log("Image loaded successfully:", newImageURL);

      // send successful load details to background.js
      sendMessageToBackground({
        type: "loadSuccessful",
        resourceType: "image",
        originalURL: blockedImageURL,
        resourceURL: newImageURL,
        status: "Image loaded successfully after rewrite",
      });
    };

    blockedImg.onerror = () => {
      console.error("Failed to load image:", newImageURL);

      // send failed load details to background.js
      sendMessageToBackground({
        type: "loadFailed",
        resourceType: "image",
        originalURL: blockedImageURL,
        resourceURL: newImageURL,
        error: "Failed to load image after rewrite",
      });
    };
  }
}

// load the toggle state on page load
loadToggleState();
