import OpenAI from "openai";

const openai = new OpenAI({
 apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {

try {

const { conversation } = req.body;

const userMessage =
conversation?.[conversation.length - 1]?.content || "";

const completion = await openai.chat.completions.create({

model: "gpt-4o-mini",

messages: [

{
role: "system",
content: `
Ti si AI turistički informator grada Biograda na Moru.

Odgovaraj kratko, korisno i turistički.

Teme:
- plaže
- marina
- restorani
- znamenitosti
- događanja
- smještaj

Ako turist pita za plaže, preporuči npr:
Dražica, Soline, Bošana.

Ako pita za marinu:
Marina Kornati.

Uvijek odgovaraj kao lokalni turistički vodič.
`
},

...conversation

]

});

const reply =
completion.choices[0].message.content;

res.status(200).json({ reply });

} catch (error) {

console.error(error);

res.status(500).json({
reply: "Došlo je do greške u AI odgovoru."
});

}

}
