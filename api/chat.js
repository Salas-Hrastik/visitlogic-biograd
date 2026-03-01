<!DOCTYPE html>
<html lang="hr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>AI Turistički Informator – Biograd na Moru</title>

<style>
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: linear-gradient(135deg, #0f4c81, #1e88e5);
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}

.chat-wrapper {
  width: 95%;
  max-width: 760px;
  height: 90vh;
  background: white;
  border-radius: 18px;
  box-shadow: 0 25px 60px rgba(0,0,0,0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  background: #0f4c81;
  color: white;
  padding: 18px;
  font-size: 18px;
  font-weight: bold;
  text-align: center;
}

.quick-buttons {
  padding: 12px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  background: #f4f7fa;
}

.quick-buttons button {
  padding: 8px 14px;
  border-radius: 20px;
  border: none;
  background: #e3f2fd;
  cursor: pointer;
  font-size: 13px;
  transition: 0.2s;
}

.quick-buttons button:hover {
  background: #bbdefb;
}

.messages {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background: #fafafa;
}

.message {
  margin-bottom: 14px;
  display: flex;
}

.user {
  justify-content: flex-end;
}

.bot {
  justify-content: flex-start;
}

.bubble {
  padding: 12px 16px;
  border-radius: 18px;
  max-width: 80%;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-line;
}

.user .bubble {
  background: #1e88e5;
  color: white;
}

.bot .bubble {
  background: #e0e0e0;
}

.input-area {
  display: flex;
  border-top: 1px solid #ddd;
}

input {
  flex: 1;
  padding: 14px;
  border: none;
  outline: none;
  font-size: 14px;
}

button.send {
  padding: 0 22px;
  background: #0f4c81;
  color: white;
  border: none;
  cursor: pointer;
  transition: 0.2s;
}

button.send:hover {
  background: #08365b;
}

.loader {
  font-size: 13px;
  color: #666;
  padding: 6px 12px;
}
</style>
</head>
<body>

<div class="chat-wrapper">
  <div class="header">
    AI Turistički Informator – Biograd na Moru
  </div>

  <div class="quick-buttons">
    <button onclick="quick('Gdje mogu na večeru?')">🍽 Večera</button>
    <button onclick="quick('Koja je najbolja plaža?')">🏖 Plaže</button>
    <button onclick="quick('Imam djecu, što preporučujete?')">👨‍👩‍👧 Djeca</button>
    <button onclick="quick('Trebam rent a car')">🚗 Rent a car</button>
    <button onclick="quick('Gdje je najbliža ljekarna?')">💊 Ljekarna</button>
  </div>

  <div class="messages" id="messages"></div>

  <div class="input-area">
    <input id="userInput" placeholder="Postavite pitanje..." />
    <button class="send" onclick="send()">Pošalji</button>
  </div>
</div>

<script>
let userLocation = null;

// Pokušaj dohvatiti lokaciju
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(position => {
    userLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };
  });
}

function addMessage(text, sender) {
  const container = document.getElementById("messages");
  const msg = document.createElement("div");
  msg.className = "message " + sender;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerText = text;

  msg.appendChild(bubble);
  container.appendChild(msg);

  container.scrollTop = container.scrollHeight;
}

function quick(text) {
  document.getElementById("userInput").value = text;
  send();
}

async function send() {
  const input = document.getElementById("userInput");
  const message = input.value.trim();
  if (!message) return;

  addMessage(message, "user");
  input.value = "";

  const loader = document.createElement("div");
  loader.className = "loader";
  loader.innerText = "Analiziram bazu podataka...";
  document.getElementById("messages").appendChild(loader);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        userLocation
      })
    });

    const data = await response.json();
    loader.remove();

    if (data.success) {
      addMessage(data.reply, "bot");
    } else {
      addMessage("Došlo je do greške u sustavu.", "bot");
    }

  } catch (error) {
    loader.remove();
    addMessage("Greška pri povezivanju sa serverom.", "bot");
  }
}

// Enter tipka
document.getElementById("userInput").addEventListener("keypress", function(e) {
  if (e.key === "Enter") {
    send();
  }
});
</script>

</body>
</html>
