let conversation = [];

async function sendMessage() {
  const input = document.getElementById("user-input");
  const message = input.value.trim();
  if (!message) return;

  addMessage(message, "user");
  input.value = "";

  conversation.push({
    role: "user",
    content: message
  });

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation })
    });

    const data = await response.json();

    if (data.reply) {
      addMessage(data.reply, "bot");
      conversation.push({
        role: "assistant",
        content: data.reply
      });
    }

  } catch (error) {
    addMessage("Greška u komunikaciji sa serverom.", "bot");
  }
}

function addMessage(text, sender) {
  const chatBox = document.getElementById("chat-box");

  const div = document.createElement("div");
  div.className = sender === "user"
    ? "user-message"
    : "bot-message";

  div.textContent = text;

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

document.getElementById("send-btn")
  .addEventListener("click", sendMessage);

document.getElementById("user-input")
  .addEventListener("keypress", function (e) {
    if (e.key === "Enter") sendMessage();
  });
