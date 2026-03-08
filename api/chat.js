export default async function handler(req, res) {

try {

const { conversation } = req.body;

const message = conversation?.[conversation.length - 1]?.content || "";

res.status(200).json({
reply: "API radi. Primio sam pitanje: " + message
});

} catch (error) {

res.status(500).json({
reply: "Greška servera"
});

}

}
