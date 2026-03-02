const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const button = document.getElementById("send-btn");

function renderResponse(data) {

  if (data.type === "info") {
    return `<div class="bot-message">${data.message}</div>`;
  }

  if (data.type === "recommendation") {

    let html = `
      <div class="bot-message">
        <strong>Kontekst:</strong> ${data.context.weather}, ${data.context.temperature}°C
        <br/><br/>
        <strong>Operativna analiza:</strong><br/>
        ${data.analysis}
        <hr/>
    `;

    data.recommendations.forEach(item => {
      html += `
        <div style="margin-bottom:15px;">
          <strong>${item.naziv}</strong><br/>
          ${item.opis}<br/>
          Ocjena: ${item.ocjena}<br/>
          <a href="${item.google_maps}" target="_blank">Google Maps</a><br/>
          ${item.web ? `<a href="${item.web}" target="_blank">Web stranica</a>` : ""}
        </div>
      `;
    });

    html += `</div>`;
    return html;
  }
}

button.addEventListener("click", async () => {

  const message = input.value;
  if (!message) return;

  chatBox.innerHTML += `<div class="user-message">${message}</div>`;
  input.value = "";

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  });

  const data = await response.json();

  chatBox.innerHTML += renderResponse(data);
  chatBox.scrollTop = chatBox.scrollHeight;
});
