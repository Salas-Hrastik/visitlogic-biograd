export default async function handler(req, res) {

if (req.method !== "POST") {
return res.status(405).json({ reply: "Method not allowed" })
}

try {

const { message } = req.body || {}

if(!message){
return res.status(200).json({ reply:"Niste postavili pitanje." })
}

const controller = new AbortController()

const timeout = setTimeout(() => {
controller.abort()
}, 7000)

const response = await fetch(
"https://api.openai.com/v1/chat/completions",
{
method: "POST",
signal: controller.signal,
headers: {
"Content-Type": "application/json",
"Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
},
body: JSON.stringify({
model: "gpt-4o-mini",
temperature:0.3,
messages: [
{
role:"system",
content:"Ti si turistički informator za Biograd na Moru. Odgovaraj kratko."
},
{
role:"user",
content:message
}
]
})
}
)

clearTimeout(timeout)

const data = await response.json()

const reply =
data?.choices?.[0]?.message?.content ||
"Trenutno nemam odgovor."

return res.status(200).json({ reply })

}

catch(error){

console.log("AI ERROR",error)

return res.status(200).json({
reply:"AI turistički informator je trenutno zauzet. Pokušajte ponovno za nekoliko sekundi."
})

}

}
