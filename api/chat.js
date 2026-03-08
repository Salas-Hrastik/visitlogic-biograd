import fs from "fs"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const mjesta = JSON.parse(
  fs.readFileSync("./data/biograd_destinacija.json","utf8")
)

function udaljenost(lat1,lon1,lat2,lon2){

  const R=6371

  const dLat=(lat2-lat1)*Math.PI/180
  const dLon=(lon2-lon1)*Math.PI/180

  const a=
  Math.sin(dLat/2)*Math.sin(dLat/2)+
  Math.cos(lat1*Math.PI/180)*
  Math.cos(lat2*Math.PI/180)*
  Math.sin(dLon/2)*Math.sin(dLon/2)

  const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))

  return R*c
}

function nadjiNajblize(lat,lon,kategorija){

  const filtrirano=mjesta.filter(m=>{

    if(!m.kategorija) return false

    return m.kategorija.toLowerCase().includes(kategorija)

  })

  const lista=filtrirano.map(m=>{

    const d=udaljenost(lat,lon,m.lat,m.lon)

    return {...m,udaljenost:d}

  })

  lista.sort((a,b)=>a.udaljenost-b.udaljenost)

  return lista.slice(0,5)
}

export default async function handler(req){

  try{

    const body = await req.json()

    const {message,location}=body

    if(location && message.toLowerCase().includes("parking")){

      const lista=nadjiNajblize(location.lat,location.lon,"parking")

      let odgovor="🅿 Najbliži parking:\n\n"

      lista.forEach((p,i)=>{

        const m=Math.round(p.udaljenost*1000)

        odgovor+=`${i+1}. ${p.naziv} – ${m} m\n${p.google_maps}\n\n`

      })

      return Response.json({reply:odgovor})

    }

    const completion=await openai.chat.completions.create({

      model:"gpt-5-3-instant",

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

    return Response.json({
      reply:completion.choices[0].message.content
    })

  }catch(e){

    return Response.json({
      reply:"Došlo je do greške u sustavu."
    })

  }

}
