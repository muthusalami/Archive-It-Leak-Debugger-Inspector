document.addEventListener("DOMContentLoaded", function () {
  const logContainer = document.getElementById("logContainer");

  chrome.storage.local.get(["consoleLogs"], (result) => {
    const logs = result.consoleLogs || [];
    logs.forEach((log) => {
      const logElement = document.createElement("div");
      logElement.textContent = log;
      logContainer.appendChild(logElement);
    });
  });
});
