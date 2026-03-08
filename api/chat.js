import OpenAI from "openai";
import data from "../podaci/biograd_master.json" assert { type: "json" };

const openai = new OpenAI({
 apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {

try {

const { conversation } = req.body;

const userMessage =
conversation?.[conversation.length - 1]?.content || "";

let context = "";

if (userMessage.toLowerCase().includes("plaž")) {

context = data.plaze.map(p =>

`🏖 ${p.naziv}
${p.opis}
📍 ${p.maps}`

).join("\n\n");

}

else if (userMessage.toLowerCase().includes("restoran")) {

context = data.restorani.map(r =>

`🍽 ${r.naziv}
${r.opis}
📍 ${r.maps}`

).join("\n\n");

}

else if (userMessage.toLowerCase().includes("znamen")) {

context = data.znamenitosti.map(z =>

`🏛 ${z.naziv}
${z.opis}
📍 ${z.maps}`

).join("\n\n");

}

const completion = await openai.chat.completions.create({

model: "gpt-4o-mini",

messages: [

{
role: "system",
content: `
Ti si AI turistički informator Biograda na Moru.

Odgovaraj kratko, turistički i pregledno koristeći ikone.
`
},

{
role: "user",
content: userMessage
},

{
role: "assistant",
content: context
}

]

});

const reply = completion.choices[0].message.content;

res.status(200).json({ reply });

} catch (error) {

console.error(error);

res.status(500).json({
reply: "Došlo je do greške."
});

}

}
