export default async function handler(req, res) {

try {

const { conversation } = req.body;

const message =
conversation?.[conversation.length - 1]?.content?.toLowerCase() || "";

let reply = "Rado ću pomoći. Pitajte o plažama, restoranima ili znamenitostima.";

if (message.includes("plaž")) {

reply = `
🏖 Plaže u Biogradu na Moru

🏖 Plaža Dražica  
najpopularnija gradska plaža  
📍 https://maps.google.com/?q=Plaza+Drazica+Biograd

🏖 Plaža Soline  
borova šuma i brojni sadržaji  
📍 https://maps.google.com/?q=Plaza+Soline+Biograd

🏖 Plaža Bošana  
mirnija plaža za opuštanje  
📍 https://maps.google.com/?q=Plaza+Bosana+Biograd
`;

}

else if (message.includes("restoran") || message.includes("gastr")) {

reply = `
🍽 Preporučeni restorani

🍽 Restoran Dupin  
svježa riba i mediteranska kuhinja  
📍 https://maps.google.com/?q=Restoran+Dupin+Biograd

🍽 Konoba Kampanel  
tradicionalna dalmatinska jela  
📍 https://maps.google.com/?q=Konoba+Kampanel+Biograd
`;

}

else if (message.includes("znamen")) {

reply = `
🏛 Znamenitosti

🏛 Zavičajni muzej Biograd  
povijest kraljevskog grada  
📍 https://maps.google.com/?q=Zavicajni+Muzej+Biograd
`;

}

res.status(200).json({ reply });

} catch (error) {

console.error(error);

res.status(500).json({
reply: "Došlo je do greške u serveru."
});

}

}
