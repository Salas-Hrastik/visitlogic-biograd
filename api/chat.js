import fs from "fs";
import path from "path";
import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ reply: "Method not allowed." });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { message } = req.body;
    const lower = message.toLowerCase();

    // 1. VRIJEME (Za dinamički naslov)
    const weatherRes = await fetch("https://api.open-meteo.com/v1/forecast?latitude=43.9375&longitude=15.4428&current_weather=true");
    const weatherData = await weatherRes.json();
    const temp = weatherData.current_weather?.temperature || "10.3";

    // 2. BAZA (JSON)
    const filePath = path.join(process.cwd(), "data", "biograd_master.json");
    const rawData = fs.readFileSync(filePath);
    const data = JSON.parse(rawData);

    // 3. PROŠIRENA LOGIKA ZA KARTICE (UX Trigger)
    let category = null;
    
    // Provjera ključnih riječi za aktivaciju strukturiranog prikaza
    if (lower.includes("restoran") || lower.includes("hrana") || lower.includes("jesti")) {
      category = "restorani";
    } else if (lower.includes("plaž") || lower.includes("more") || lower.includes("kupanje")) {
      category = "plaze";
    } else if (lower.includes("šetnj") || lower.includes("obići") || lower.includes("znamenitost") || lower.includes("park")) {
      // Ovdje mapiramo "šetnju" na kategoriju u vašem JSON-u (npr. 'atrakcije' ili 'šetnice')
      category = "atrakcije"; 
    }

    // Ako smo pogodili kategoriju, šaljemo IDENTIČNU STRUKTURU kao za restorane
    if (category && data.kategorije[category]) {
      const results = data.kategorije[category]
        .filter(item => item.ocjena >= 4.0)
        .sort((a, b) => b.ocjena - a.ocjena)
        .slice(0, 3);

      return res.status(200).json({
        type: "cards",
        title: `Preporuke (${temp}°C)`,
        items: results.map(r => ({
          naziv: r.naziv,
          opis: r.opis,
          ocjena: r.ocjena,
          adresa: r.adresa || "Biograd na Moru",
          // Precizan link za "Otvori na karti" gumb
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`,
          lat: r.lat,
          lng: r.lng
        }))
      });
    }

    // 4. AI FALLBACK (Samo za općenita pitanja)
    // Forsiramo Markdown kako bi čak i običan tekst bio pregledniji
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Ti si turistički informator. Odgovaraj ISKLJUČIVO u kratkim natuknicama s emojijima. 
          Maksimalno 3 točke. Svaka točka mora biti u novom redu s razmakom.`
        },
        { role: "user", content: message }
      ],
      temperature: 0.3
    });

    return res.status(200).json({
      type: "text",
      reply: completion.choices[0].message.content
    });

  } catch (error) {
    return res.status(500).json({ reply: "Greška u sustavu." });
  }
}
