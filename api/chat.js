import fs from "fs";
import path from "path";
import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ reply: "Metoda nije dopuštena." });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { message } = req.body;
    const lower = message.toLowerCase();

    // 1. DOHVAT VREMENA (Za naslov preporuka)
    const weatherRes = await fetch("https://api.open-meteo.com/v1/forecast?latitude=43.9375&longitude=15.4428&current_weather=true");
    const weatherData = await weatherRes.json();
    const temp = weatherData.current_weather?.temperature || "10.3";
    const condition = "vrijeme"; // Ovdje možete mapirati kodove vremena ako želite (npr. oblačno)

    // 2. UČITAVANJE BAZE (JSON)
    const filePath = path.join(process.cwd(), "data", "biograd_master.json");
    const rawData = fs.readFileSync(filePath);
    const data = JSON.parse(rawData);

    // 3. PROŠIRENA LOGIKA KATEGORIZACIJE (UX Trigger)
    // Cilj je mapirati korisnikov upit na točan ključ u vašem JSON-u
    let odabranaKategorija = null;

    if (lower.includes("restoran") || lower.includes("hrana") || lower.includes("jesti")) {
      odabranaKategorija = "restorani";
    } else if (lower.includes("plaž") || lower.includes("more") || lower.includes("kupanje")) {
      odabranaKategorija = "plaze";
    } else if (lower.includes("šetnj") || lower.includes("obići") || lower.includes("znamenitost") || lower.includes("park") || lower.includes("kamo ići")) {
      // Provjerite zove li se u vašem JSON-u "atrakcije" ili "znamenitosti"
      odabranaKategorija = "atrakcije"; 
    }

    // 4. GENERIRANJE KARTICA (Ako je kategorija pronađena)
    if (odabranaKategorija && data.kategorije[odabranaKategorija]) {
      const rezultati = data.kategorije[odabranaKategorija]
        .filter(item => item.ocjena >= 4.0)
        .sort((a, b) => b.ocjena - a.ocjena)
        .slice(0, 3);

      if (rezultati.length > 0) {
        return res.status(200).json({
          type: "cards",
          title: `Preporuke (${temp}°C)`,
          items: rezultati.map(r => ({
            naziv: r.naziv,
            opis: r.opis,
            ocjena: r.ocjena,
            adresa: r.adresa || "Biograd na Moru",
            // Google Maps link na temelju koordinata iz JSON-a
            mapsUrl: `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`,
            lat: r.lat,
            lng: r.lng
          }))
        });
      }
    }

    // 5. STRUKTURIRANI AI FALLBACK (Ako nema podudaranja u bazi)
    // Ako AI mora odgovoriti tekstom, prisiljavamo ga na preglednost
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Ti si turistički informator za Biograd. 
          NE piši duge odlomke. 
          Koristi ISKLJUČIVO kratke natuknice s emojijima. 
          Svaka preporuka mora imati svoj naslov i prazan red razmaka.`
        },
        { role: "user", content: `Upit: ${message}. Trenutno je ${temp}°C.` }
      ],
      temperature: 0.3 // Smanjuje "brbljavost" AI-ja
    });

    return res.status(200).json({
      type: "text",
      reply: completion.choices[0].message.content
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ reply: "Sustav trenutno nije dostupan." });
  }
}
