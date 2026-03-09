import fs from "fs"

const data = JSON.parse(
fs.readFileSync("./data/biograd_clean.json","utf8")
)

function filterCategory(cat){

return data.filter(o => o.kategorija === cat)

}

export default async function handler(req,res){

if(req.method !== "POST"){
return res.status(405).json({reply:"Method not allowed"})
}

const {message} = req.body

const q = message.toLowerCase()

// RESTORANI

if(q.includes("restoran")){

const list = filterCategory("restaurant")

if(!list.length){
return res.status(200).json({reply:"Nemam restorane u bazi."})
}

let txt = "Restorani u Biogradu:\n\n"

list.slice(0,20).forEach(r=>{
txt += `${r.naziv}\n`
txt += `${r.google_maps}\n\n`
})

return res.status(200).json({reply:txt})

}

// PLAŽE

if(q.includes("plaž")){

const list = filterCategory("beach")

let txt = "Plaže u Biogradu:\n\n"

list.slice(0,20).forEach(r=>{
txt += `${r.naziv}\n`
txt += `${r.google_maps}\n\n`
})

return res.status(200).json({reply:txt})

}

// PARKING

if(q.includes("parking")){

const list = filterCategory("parking")

let txt = "Parkirališta:\n\n"

list.slice(0,20).forEach(r=>{
txt += `${r.google_maps}\n\n`
})

return res.status(200).json({reply:txt})

}

// BANKOMATI

if(q.includes("bankomat") || q.includes("atm")){

const list = filterCategory("atm")

let txt = "Bankomati u blizini:\n\n"

list.slice(0,20).forEach(r=>{
txt += `${r.google_maps}\n\n`
})

return res.status(200).json({reply:txt})

}

// ako nije lokalna tema → AI odgovor

try{

const response = await fetch(
"https://api.openai.com/v1/chat/completions",
{
method:"POST",
headers:{
"Content-Type":"application/json",
"Authorization":`Bearer ${process.env.OPENAI_API_KEY}`
},
body:JSON.stringify({
model:"gpt-4o-mini",
messages:[
{
role:"system",
content:"Ti si turistički vodič za Biograd na Moru."
},
{
role:"user",
content:message
}
]
})
}
)

const dataAI = await response.json()

const reply =
dataAI?.choices?.[0]?.message?.content ||
"Nemam odgovor."

return res.status(200).json({reply})

}catch(e){

return res.status(200).json({
reply:"AI trenutno nije dostupan."
})

}

}
