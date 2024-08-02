document.addEventListener("DOMContentLoaded", function () {
  console.log("Popup loaded and ready");
  const messageList = document.getElementById("message-list");

  // listen for messages from the background script
  chrome.runtime.onMessage.addListener(function (message) {
    if (message.type === "console-message") {
      console.log("Received console message", message);
      const messageItem = document.createElement("div");
      messageItem.textContent = `${message.messageType.toUpperCase()}: ${
        message.message
      }`;
      messageList.appendChild(messageItem);
    }
  });
});
