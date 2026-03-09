import path from "path"
import fs from "fs"

export default async function handler(req,res){

if(req.method !== "POST"){
return res.status(405).json({reply:"Method not allowed"})
}

try{

const {message} = req.body || {}

const q = (message || "").toLowerCase()

/* učitaj bazu */

const filePath = path.join(process.cwd(),"data","biograd_clean.json")

const raw = fs.readFileSync(filePath,"utf8")

const data = JSON.parse(raw)

/* RESTORANI */

if(q.includes("restoran")){

const list = data.filter(o => o.kategorija === "restaurant")

if(!list.length){
return res.status(200).json({
reply:"Nemam restorane u bazi."
})
}

let txt = "Restorani u Biogradu:\n\n"

list.slice(0,20).forEach(r => {

txt += r.naziv + "\n"
txt += r.google_maps + "\n\n"

})

return res.status(200).json({reply:txt})

}

/* DEFAULT */

return res.status(200).json({
reply:"Primio sam pitanje, ali još nemam specifičan odgovor."
})

}catch(err){

console.log(err)

return res.status(200).json({
reply:"Greška pri čitanju baze podataka."
})

}

}
