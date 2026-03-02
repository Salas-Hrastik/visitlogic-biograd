async function sendMessage() {

  const input = document.getElementById("user-input");
  const message = input.value.trim();
  if (!message) return;

  addUserMessage(message);
  input.value = "";

  try {

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation: [{ role: "user", content: message }]
      })
    });

    const data = await response.json();

    if (data.type === "cards" || data.type === "ai_cards") {
      renderCards(data);
    } else if (data.reply) {
      renderPlainText(data.reply);
    }

  } catch {
    renderPlainText("Greška u komunikaciji.");
  }
}

function addUserMessage(text) {
  const chatBox = document.getElementById("chat-box");
  const div = document.createElement("div");
  div.className = "user-message";
  div.textContent = text;
  chatBox.appendChild(div);
}

function renderCards(data) {

  const chatBox = document.getElementById("chat-box");
  const wrapper = document.createElement("div");
  wrapper.className = "bot-message";

  const heading = document.createElement("h3");
  heading.textContent = data.title;
  wrapper.appendChild(heading);

  data.items.forEach(item => {

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="card-title">
        ${item.ikona ? item.ikona : "📍"} ${item.naziv}
      </div>
      <div class="card-description">
        ${item.opis}
      </div>
    `;

    if (item.lat && item.lng) {
      const btn = document.createElement("button");
      btn.className = "map-btn";
      btn.innerText = "📍 Otvori na karti";
      btn.onclick = () => openMapModal(item.lat, item.lng);
      card.appendChild(btn);
    }

    wrapper.appendChild(card);
  });

  chatBox.appendChild(wrapper);
}

function renderPlainText(text) {
  const chatBox = document.getElementById("chat-box");
  const div = document.createElement("div");
  div.className = "bot-message";
  div.textContent = text;
  chatBox.appendChild(div);
}

function openMapModal(lat, lng) {
  const modal = document.getElementById("modal");
  const iframe = document.getElementById("modal-iframe");
  iframe.src = `https://www.google.com/maps?q=${lat},${lng}&output=embed`;
  modal.style.display = "flex";
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
  document.getElementById("modal-iframe").src = "";
}

document.getElementById("send-btn")
  .addEventListener("click", sendMessage);
