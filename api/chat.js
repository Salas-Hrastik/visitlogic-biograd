import fs from "fs"
import path from "path"

export default function handler(req,res){

try{

const filePath = path.join(process.cwd(),"podaci","biograd.json")

const raw = fs.readFileSync(filePath,"utf8")

const data = JSON.parse(raw)

const {message} = req.body || {}

const q = (message || "").toLowerCase()

if(q.includes("restoran")){

const list = data.filter(o => o.kategorija === "restaurant")

let txt = "Restorani u Biogradu:\n\n"

list.slice(0,20).forEach(r => {

txt += r.naziv + "\n"
txt += r.google_maps + "\n\n"

})

return res.status(200).json({reply:txt})

}

return res.status(200).json({
reply:"Baza je učitana. Postavite pitanje."
})

}catch(e){

console.log(e)

return res.status(200).json({
reply:"Greška pri čitanju baze podataka."
})

}

}
