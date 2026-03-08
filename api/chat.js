export default async function handler(req, res) {

try {

const { conversation } = req.body;

const message =
conversation?.[conversation.length - 1]?.content?.toLowerCase() || "";

let reply = "";

if (message.includes("plaž")) {

reply = `
<div style="display:flex;flex-direction:column;gap:14px">

<div style="background:#f3f7fb;padding:14px;border-radius:10px">
<h3>🏖 Plaža Dražica</h3>
👨‍👩‍👧 idealna za obitelji<br>
🌊 šljunčana plaža<br>
🌲 borova šuma<br><br>
<a href="https://maps.google.com/?q=Plaza+Drazica+Biograd" target="_blank">
📍 Otvori na Google Maps
</a>
</div>

<div style="background:#f3f7fb;padding:14px;border-radius:10px">
<h3>🏖 Plaža Soline</h3>
🌲 borova šuma<br>
🍹 beach barovi<br>
🚶 blizu centra<br><br>
<a href="https://maps.google.com/?q=Plaza+Soline+Biograd" target="_blank">
📍 Otvori na Google Maps
</a>
</div>

<div style="background:#f3f7fb;padding:14px;border-radius:10px">
<h3>🏖 Plaža Bošana</h3>
😌 mirnija atmosfera<br>
🌊 čisto more<br><br>
<a href="https://maps.google.com/?q=Plaza+Bosana+Biograd" target="_blank">
📍 Otvori na Google Maps
</a>
</div>

</div>
`;

}

else if (message.includes("restoran") || message.includes("gastr")) {

reply = `
<div style="display:flex;flex-direction:column;gap:14px">

<div style="background:#f3f7fb;padding:14px;border-radius:10px">
<h3>🍽 Restoran Dupin</h3>
🐟 svježa riba<br>
🍷 mediteranska kuhinja<br><br>
<a href="https://maps.google.com/?q=Restoran+Dupin+Biograd" target="_blank">
📍 Google Maps
</a>
</div>

<div style="background:#f3f7fb;padding:14px;border-radius:10px">
<h3>🍝 Konoba Kampanel</h3>
🍷 dalmatinska kuhinja<br>
🐟 riblji specijaliteti<br><br>
<a href="https://maps.google.com/?q=Konoba+Kampanel+Biograd" target="_blank">
📍 Google Maps
</a>
</div>

</div>
`;

}

else {

reply = `
👋 Dobrodošli u Biograd na Moru!

Mogu vam pomoći sa:

🏖 Plaže  
🍽 Gastronomija  
🏛 Znamenitosti  
🎉 Događanja  
🏨 Smještaj

Postavite pitanje ili kliknite opciju iz izbornika.
`;

}

res.status(200).json({ reply });

} catch (error) {

console.error(error);

res.status(500).json({
reply: "Došlo je do greške."
});

}

}
