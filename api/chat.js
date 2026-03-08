import fs from "fs"
import OpenAI from "openai"

const openai = new OpenAI({
 apiKey: process.env.OPENAI_API_KEY
})

const mjesta = JSON.parse(
 fs.readFileSync("./data/biograd_destinacija.json","utf8")
)

function udaljenost(lat1, lon1, lat2, lon2){

 const R = 6371

 const dLat = (lat2-lat1) * Math.PI/180
 const dLon = (lon2-lon1) * Math.PI/180

 const a =
 Math.sin(dLat/2)*Math.sin(dLat/2) +
 Math.cos(lat1*Math.PI/180) *
 Math.cos(lat2*Math.PI/180) *
 Math.sin(dLon/2)*Math.sin(dLon/2)

 const c = 2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))

 return R*c
}

function nadjiNajblize(userLat,userLon,kategorija){

 const filtrirano = mjesta.filter(m =>
 m.kategorija && m.kategorija.includes(kategorija)
 )

 const sUdaljenosti = filtrirano.map(m=>{

 const d = udaljenost(
 userLat,
 userLon,
 m.lat,
 m.lon
 )

 return {...m,udaljenost:d}

 })

 sUdaljenosti.sort((a,b)=>a.udaljenost-b.udaljenost)

 return sUdaljenosti.slice(0,5)
}

export default async function handler(req,res){

 if(req.method!=="POST"){
 return res.status(405).json({error:"Method not allowed"})
 }

 const {message,location,lang} = req.body

 let odgovor=""

 const tekst = message.toLowerCase()

 if(location && tekst.includes("parking")){

 const lista = nadjiNajblize(location.lat,location.lon,"parking")

 odgovor="🅿 Najbliži parking:\n\n"

 lista.forEach((p,i)=>{

 const m = Math.round(p.udaljenost*1000)

 odgovor+=`${i+1}. ${p.naziv} – ${m} m\n${p.google_maps}\n\n`

 })

 return res.json({reply:odgovor})
 }

 if(location && (tekst.includes("restoran") || tekst.includes("restaurant") || tekst.includes("food"))){

 const lista = nadjiNajblize(location.lat,location.lon,"restaurant")

 odgovor="🍽 Najbliži restorani:\n\n"

 lista.forEach((p,i)=>{

 const m = Math.round(p.udaljenost*1000)

 odgovor+=`${i+1}. ${p.naziv} – ${m} m\n${p.google_maps}\n\n`

 })

 return res.json({reply:odgovor})
 }

 const systemPrompt = `
Ti si turistički vodič za Biograd na Moru.
Odgovaraj kratko i korisno.
Odgovaraj na jeziku: ${lang || "en"}.
`

 const completion = await openai.chat.completions.create({

 model:"gpt-5-3-instant",

 messages:[
 {role:"system",content:systemPrompt},
 {role:"user",content:message}
 ]

 })

 odgovor = completion.choices[0].message.content

 res.json({reply:odgovor})

}
