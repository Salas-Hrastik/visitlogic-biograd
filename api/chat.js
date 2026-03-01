import fs from "fs";
import path from "path";

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    0.5 - Math.cos(dLat)/2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    (1 - Math.cos(dLon))/2;

  return R * 2 * Math.asin(Math.sqrt(a));
}

function flattenData(data) {
  const objekti = [];

  for (const kategorija in data.kategorije) {
    const items = data.kategorije[kategorija];

    if (Array.isArray(items)) {
      items.forEach((item, index) => {
        objekti.push({
          id: `${kategorija}_${index}`,
          naziv: item.naziv,
          kategorije: [kategorija],
          ...item
        });
      });
    }
  }

  return objekti;
}

export default async function handler(req, res) {
  try {
    const { message, userLocation } = req.body;

    const filePath = path.join(process.cwd(), "data", "biograd_master.json");
    const rawData = fs.readFileSync(filePath);
    const data = JSON.parse(rawData);

    const objekti = flattenData(data);

    let results = objekti;

    if (message.toLowerCase().includes("restoran")) {
      results = objekti.filter(o => o.kategorije.includes("restorani"));
    }

    if (message.toLowerCase().includes("plaža")) {
      results = objekti.filter(o => o.kategorije.includes("plaze"));
    }

    if (message.toLowerCase().includes("djeca")) {
      results = objekti.filter(o => o.kategorije.includes("djecji_sadrzaji"));
    }

    if (userLocation) {
      results = results.map(o => {
        if (o.koordinate) {
          const distance = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            o.koordinate.lat,
            o.koordinate.lng
          );
          return { ...o, distance };
        }
        return o;
      }).sort((a, b) => (a.distance || 999) - (b.distance || 999));
    }

    results = results
      .filter(o => o.ocjena >= 4.3)
      .sort((a, b) => b.ocjena - a.ocjena)
      .slice(0, 5);

    res.status(200).json({
      success: true,
      results
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Greška u obradi zahtjeva."
    });
  }
}
