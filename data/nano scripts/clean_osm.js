import fs from "fs"

const raw = JSON.parse(
fs.readFileSync("./data/biograd_osm.json")
)

const elements = raw.elements || []

const cleaned = elements
.filter(e => e.tags)
.map(e => ({

naziv: e.tags.name || "Nepoznato",

kategorija:
e.tags.amenity ||
e.tags.tourism ||
e.tags.leisure ||
e.tags.shop ||
"other",

lat: e.lat,
lon: e.lon,

google_maps:
`https://www.google.com/maps?q=${e.lat},${e.lon}`

}))

fs.writeFileSync(
"./data/biograd_clean.json",
JSON.stringify(cleaned,null,2)
)

console.log("Nova baza:", cleaned.length)
