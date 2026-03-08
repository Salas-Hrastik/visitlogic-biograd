import fs from "fs"

const OVERPASS_URL =
"https://overpass-api.de/api/interpreter"

const query = `
[out:json][timeout:25];

area["name"="Biograd na Moru"]->.searchArea;

(
node["amenity"](area.searchArea);
node["tourism"](area.searchArea);
node["leisure"](area.searchArea);
node["shop"](area.searchArea);
);

out body;
`

async function run(){

console.log("Preuzimam podatke iz OpenStreetMap...")

const response = await fetch(OVERPASS_URL,{
method:"POST",
body:query
})

const data = await response.json()

console.log("Objekata pronađeno:",data.elements.length)

const objects = data.elements
.filter(o=>o.tags)
.map(o=>({

naziv:o.tags.name || "Nepoznato",

kategorija:
o.tags.amenity ||
o.tags.tourism ||
o.tags.leisure ||
o.tags.shop ||
"other",

lat:o.lat,

lon:o.lon,

google_maps:
`https://www.google.com/maps?q=${o.lat},${o.lon}`

}))

fs.writeFileSync(
"./data/biograd_osm.json",
JSON.stringify(objects,null,2)
)

console.log("Baza spremljena u data/biograd_osm.json")

}

run()
