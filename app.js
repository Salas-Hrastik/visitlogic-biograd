async function sendMessage() {
  const input = document.getElementById("user-input");
  const message = input.value.trim();
  if (!message) return;

  addMessage(message, "user");
  input.value = "";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      throw new Error("Server error");
    }

    const data = await response.json();

    console.log("SERVER RESPONSE:", data); // Debug

    if (data && data.reply) {
      addMessage(data.reply, "bot");
    } else {
      addMessage("Odgovor servera nije ispravan.", "bot");
    }

  } catch (error) {
    console.error("FETCH ERROR:", error);
    addMessage("Greška u komunikaciji sa serverom.", "bot");
  }
}

function addMessage(text, sender) {
  const chatBox = document.getElementById("chat-box");

  const div = document.createElement("div");
  div.className = sender === "user" 
    ? "user-message" 
    : "bot-message";

  div.innerText = text ?? "Prazan odgovor.";

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

document.getElementById("send-btn")
  .addEventListener("click", sendMessage);

// Omogućuje Enter tipku
document.getElementById("user-input")
  .addEventListener("keypress", function(e) {
    if (e.key === "Enter") {
      sendMessage();
    }
  });
