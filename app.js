async function sendMessage() {
  const input = document.getElementById("user-input");
  const message = input.value.trim();
  if (!message) return;

  addMessage(message, "user");
  input.value = "";

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  });

  const data = await response.json();

  addMessage(data.reply, "bot");
}

function addMessage(text, sender) {
  const chatBox = document.getElementById("chat-box");

  const div = document.createElement("div");
  div.className = sender === "user" ? "user-message" : "bot-message";
  div.innerText = text;

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

document.getElementById("send-btn").addEventListener("click", sendMessage);
