export default async function handler(req, res) {

if (req.method !== "POST") {
return res.status(405).json({ reply: "Method not allowed" })
}

try {

const { message } = req.body || {}

return res.status(200).json({
reply: "Primio sam vaše pitanje: " + message
})

} catch (error) {

return res.status(200).json({
reply: "Došlo je do greške."
})

}

}
