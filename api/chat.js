import fs from "fs"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const mjesta = JSON.parse(
  fs.readFileSync("./data/biograd_destinacija.json", "utf8")
)

function udaljenost(lat1, lon1, lat2, lon2){

  const R = 6371

  const dLat = (lat2 - lat1) * Math.PI/180
  const dLon = (lon2 - lon1) * Math.PI/180

  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI/180) *
    Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

  return R * c
}

function nadjiNajblize(userLat,userLon,kategorija){

  const filtrirano = mjesta.filter(m => {

    if(!m.kategorija) return false

    return m.kategorija.toLowerCase().includes(kategorija)

  })

  const sUdaljenosti = filtrirano.map(m => {

    const d = udaljenost(
      userLat,
      userLon,
      m.lat,
      m.lon
    )

    return {
      ...m,
      udaljenost:d
    }

  })

  sUdaljenosti.sort((a,b)=>a.udaljenost-b.udaljenost)

  return sUdaljenosti.slice(0,5)
}

async function klasificirajUpit(poruka){

  const prompt = `
Klasificiraj turističko pitanje u jednu od kategorija.

Moguće kategorije:

parking
restaurant
beach
atm
pharmacy
museum
bar
cafe
general

Vrati SAMO naziv kategorije.

Pitanje:
${poruka}
`

  const completion = await openai.chat.completions.create({

    model:"gpt-5-3-instant",

    messages:[
      {role:"user",content:prompt}
    ]

  })

  return completion.choices[0].message.content.trim().toLowerCase()

}

export default async function handler(req,res){

  if(req.method !== "POST"){
    return res.status(405).json({error:"Method not allowed"})
  }

  const {message,location,lang} = req.body

  let odgovor = ""

  let kategorija = "general"

  try{

    kategorija = await klasificirajUpit(message)

  }catch(e){

    console.log("AI klasifikacija greška")

  }

  if(location && kategorija !== "general"){

    const lista = nadjiNajblize(
      location.lat,
      location.lon,
      kategorija
    )

    if(lista.length > 0){

      odgovor = `Najbliže lokacije:\n\n`

      lista.forEach((p,i)=>{

        const m = Math.round(p.udaljenost*1000)

        odgovor += `${i+1}. ${p.naziv} – ${m} m\n${p.google_maps}\n\n`

      })

      return res.json({reply:odgovor})

    }

  }

  const systemPrompt = `
Ti si turistički vodič za Biograd na Moru.

Odgovaraj kratko i korisno.

Ako je moguće predloži restorane, plaže, atrakcije ili infrastrukturu.

Odgovaraj na jeziku korisnika: ${lang || "en"}.
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
