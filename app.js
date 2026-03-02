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
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ conversation })
    });

    if (!response.ok) {
      throw new Error("Server error");
    }

    const data = await response.json();
    console.log("SERVER RESPONSE:", data);

    if (data && data.reply) {

      addMessage(data.reply, "bot");

      conversation.push({
        role: "assistant",
        content: data.reply
      });

    } else {
      addMessage("Odgovor servera nije ispravan.", "bot");
    }

  } catch (error) {
    console.error("FETCH ERROR:", error);
    addMessage("Greška u komunikaciji sa serverom.", "bot");
  }
}

function formatLinks(text) {

  const urlRegex = /(https?:\/\/[^\s]+)/g;

  return text.replace(urlRegex, function(url) {

    let label = "Otvori link";

    if (url.includes("google")) {
      label = "Otvori Google Maps";
    }

    if (url.includes("http")) {
      return `<br><a href="${url}" target="_blank" 
        style="
          display:inline-block;
          margin-top:6px;
          padding:6px 12px;
          background:#1f4e79;
          color:white;
          border-radius:6px;
          text-decoration:none;
          font-size:14px;
        ">
        ${label}
      </a>`;
    }

    return url;
  });
}

function addMessage(text, sender) {
  const chatBox = document.getElementById("chat-box");

  const div = document.createElement("div");
  div.className = sender === "user"
    ? "user-message"
    : "bot-message";

  div.innerHTML = formatLinks(text ?? "Prazan odgovor.");

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

document.getElementById("send-btn")
  .addEventListener("click", sendMessage);

document.getElementById("user-input")
  .addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      sendMessage();
    }
  });
