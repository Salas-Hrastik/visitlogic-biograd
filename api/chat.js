export default async function handler(req, res) {

try {

const { conversation } = req.body;

const message =
conversation?.[conversation.length - 1]?.content?.toLowerCase() || "";

let reply = "";

if (message.includes("plaž")) {

reply = `
<div style="background:#f3f7fb;padding:14px;border-radius:10px">
<h3>🏖 Plaža Dražica</h3>
👨‍👩‍👧 idealna za obitelji<br>
🌊 šljunčana plaža<br>
🌲 borova šuma<br><br>
<a href="https://maps.google.com/?q=Plaza+Drazica+Biograd" target="_blank">
📍 Otvori na Google Maps
</a>
</div>
`;

}

else {

reply = "👋 Pitajte me o plažama, restoranima ili znamenitostima.";

}

res.status(200).json({ reply });

} catch (error) {

console.error(error);

res.status(500).json({
reply: "Došlo je do greške u serveru."
});

}

}
