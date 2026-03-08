import OpenAI from "openai";
import fs from "fs";
import path from "path";

const openai = new OpenAI({
 apiKey: process.env.OPENAI_API_KEY
});

function loadData(){

const filePath = path.join(process.cwd(),"podaci","biograd_master.json");

const raw = fs.readFileSync(filePath);

return JSON.parse(raw);

}

export default async function handler(req,res){

try{

const {conversation} = req.body;

const userMessage =
conversation?.[conversation.length-1]?.content || "";

const data = loadData();

let context = "";

if(userMessage.toLowerCase().includes("plaž")){

context = data.plaze.map(p =>

`🏖 ${p.naziv}
${p.opis}
📍 ${p.maps}`

).join("\n\n");

}

else if(userMessage.toLowerCase().includes("restoran")){

context = data.restorani.map(r =>

`🍽 ${r.naziv}
${r.opis}
📍 ${r.maps}`

).join("\n\n");

}

else if(userMessage.toLowerCase().includes("znamen")){

context = data.znamenitosti.map(z =>

`🏛 ${z.naziv}
${z.opis}
📍 ${z.maps}`

).join("\n\n");

}

const completion = await openai.chat.completions.create({

model:"gpt-4o-mini",

messages:[

{
role:"system",
content:`
Ti si AI turistički informator Biograda na Moru.

Koristi lokalne podatke destinacije.

Odgovori kratko i pregledno koristeći ikone.
`
},

{
role:"user",
content:userMessage
},

{
role:"assistant",
content:context
}

]

});

const reply = completion.choices[0].message.content;

res.status(200).json({reply});

}catch(error){

console.error(error);

res.status(500).json({
reply:"Došlo je do greške."
});

}

}
