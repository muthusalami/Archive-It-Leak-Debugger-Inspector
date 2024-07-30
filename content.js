(function () {
  const originalConsoleLog = console.log;

  console.log = function (...args) {
    originalConsoleLog.apply(console, args);
    chrome.runtime.sendMessage({
      action: "logMessage",
      message: args.join(" "),
    });
  };
})();
