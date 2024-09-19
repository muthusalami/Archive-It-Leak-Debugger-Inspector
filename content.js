console.log("Content script running");

document.addEventListener("securitypolicyviolation", (event) => {
  const violationDetails = {
    blockedURI: event.blockedURI || "Inline or eval resource",
    violatedDirective: event.violatedDirective,
    documentURI: event.documentURI,
  };

  console.log(`CSP violation detected:`, violationDetails);

  // violation check - inline or eval resource
  if (violationDetails.blockedURI === "Inline or eval resource") {
    console.log("Inline or eval resource blocked.");
  }

  // send the violation details to the background script to store and track
  chrome.runtime.sendMessage(
    {
      type: "cspViolation",
      details: violationDetails,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error sending message to background script:",
          chrome.runtime.lastError.message
        );
      } else {
        console.log("Violation message sent successfully.");
      }
    }
  );
});
