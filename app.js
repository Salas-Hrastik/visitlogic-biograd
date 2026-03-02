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
      body: JSON.stringify({
        conversation: [{ role: "user", content: message }]
      })
    });

    const data = await response.json();

    if (data.type === "cards") {
      renderCards(data);
    } else if (data.reply) {
      addTextMessage(data.reply, "bot");
    }

  } catch (error) {
    console.error("FETCH ERROR:", error);
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

    const mapButton = (item.lat && item.lng)
      ? `<button class="map-btn"
           onclick="openMapModal(${item.lat}, ${item.lng})">
           📍 Otvori na karti
         </button>`
      : `<button class="map-btn disabled-btn" disabled>
           📍 Nema koordinata
         </button>`;

    const webButton = item.web
      ? `<button class="web-btn"
           onclick="openWebModal('${item.web}')">
           🌐 Web
         </button>`
      : "";

    card.innerHTML = `
      <strong>${item.naziv}</strong><br>
      ⭐ ${item.ocjena}<br>
      📍 ${item.adresa}<br>
      <p>${item.opis}</p>
      ${mapButton}
      ${webButton}
    `;

    wrapper.appendChild(card);
  });

  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function openMapModal(lat, lng) {

  if (!lat || !lng) return;

  const modal = document.getElementById("modal");
  const iframe = document.getElementById("modal-iframe");

  iframe.src = `https://www.google.com/maps?q=${lat},${lng}&output=embed`;
  modal.style.display = "flex";
}

function openWebModal(url) {

  if (!url) return;

  const modal = document.getElementById("modal");
  const iframe = document.getElementById("modal-iframe");

  iframe.src = url;
  modal.style.display = "flex";
}

function closeModal() {

  const modal = document.getElementById("modal");
  const iframe = document.getElementById("modal-iframe");

  iframe.src = "";
  modal.style.display = "none";
}

document.getElementById("send-btn")
  .addEventListener("click", sendMessage);

document.getElementById("user-input")
  .addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      sendMessage();
    }
  });
