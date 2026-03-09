export default async function handler(req) {

try {

const body = await req.json()

const message = body.message || ""

const response = await fetch("https://api.openai.com/v1/chat/completions", {

method: "POST",

headers: {
"Content-Type": "application/json",
"Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
},

body: JSON.stringify({

model: "gpt-4o-mini",

messages: [
{
role: "system",
content: "Ti si turistički vodič za Biograd na Moru. Odgovaraj kratko i korisno."
},
{
role: "user",
content: message
}
]

})

})

const data = await response.json()

return new Response(
JSON.stringify({
reply: data.choices?.[0]?.message?.content || "Bot nema odgovor."
}),
{ headers: { "Content-Type": "application/json" } }
)

} catch (error) {

console.log(error)

return new Response(
JSON.stringify({
reply: "AI turistički informator trenutno nije dostupan."
}),
{ headers: { "Content-Type": "application/json" } }
)

}

}
