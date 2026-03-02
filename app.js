async function sendMessage() {

  const input = document.getElementById("user-input");
  const message = input.value.trim();
  if (!message) return;

  addTextMessage(message, "user");
  input.value = "";

  try {

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation: [{ role: "user", content: message }] })
    });

    const data = await response.json();

    if (data.type === "cards") {
      renderCards(data);
    } else if (data.reply) {
      addTextMessage(data.reply, "bot");
    }

  } catch (error) {
    addTextMessage("Greška u komunikaciji sa serverom.", "bot");
  }
}

function addTextMessage(text, sender) {

  const chatBox = document.getElementById("chat-box");

  const div = document.createElement("div");
  div.className = sender === "user"
    ? "user-message"
    : "bot-message";

  div.textContent = text;

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function renderCards(data) {

  const chatBox = document.getElementById("chat-box");

  const wrapper = document.createElement("div");
  wrapper.className = "bot-message";

  if (data.title) {
    const title = document.createElement("h3");
    title.textContent = data.title;
    wrapper.appendChild(title);
  }

  data.items.forEach(item => {

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <strong>${item.naziv}</strong><br>
      ⭐ ${item.ocjena}<br>
      📍 ${item.adresa}<br>
      <p>${item.opis}</p>
      <a href="${item.google_maps}" target="_blank" class="map-btn">📍 Otvori na karti</a>
      ${item.web ? `<a href="${item.web}" target="_blank" class="web-btn">🌐 Web</a>` : ""}
    `;

    wrapper.appendChild(card);
  });

  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;
}

document.getElementById("send-btn")
  .addEventListener("click", sendMessage);

document.getElementById("user-input")
  .addEventListener("keypress", function (e) {
    if (e.key === "Enter") sendMessage();
  });
