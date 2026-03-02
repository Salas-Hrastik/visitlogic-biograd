import fs from "fs";
import path from "path";
import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ reply: "Method not allowed." });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { message } = req.body;

    // 1. DOHVAT VREMENA
    const weatherRes = await fetch("https://api.open-meteo.com/v1/forecast?latitude=43.9375&longitude=15.4428&current_weather=true");
    const weatherData = await weatherRes.json();
    const temp = weatherData.current_weather?.temperature || "10.3";

    // 2. UČITAVANJE BAZE
    const filePath = path.join(process.cwd(), "data", "biograd_master.json");
    const rawData = fs.readFileSync(filePath);
    const db = JSON.parse(rawData);

    // 3. AI KLASIFIKACIJA I ODGOVOR (Structured Output)
    // Umjesto da pogađamo ključne riječi, AI-ju dajemo imena tvojih kategorija iz JSON-a
    const kategorijeIzBaze = Object.keys(db.kategorije).join(", ");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Ti si mozak turističkog informatora. Tvoj zadatak je analizirati upit i odlučiti koju kategoriju iz baze podataka prikazati.
          Dostupne kategorije u bazi su: [${kategorijeIzBaze}].
          
          VRATI ISKLJUČIVO JSON u ovom formatu:
          {
            "kategorija": "ime_kategorije_ili_null",
            "ai_odgovor": "Kratka rečenica konteksta (npr. 'Evo prijedloga za šetnju po ovom oblačnom vremenu.')",
            "savjet": "Kratki savjet temeljen na temperaturi od ${temp}°C"
          }`
        },
        { role: "user", content: message }
      ],
      response_format: { type: "json_object" } // Prisiljava model na JSON
    });

    const aiAnaliza = JSON.parse(completion.choices[0].message.content);
    const odabranaKategorija = aiAnaliza.kategorija;

    // 4. LOGIKA ZA PRIKAZ KARTICA (Kao kod restorana)
    if (odabranaKategorija && db.kategorije[odabranaKategorija]) {
      const rezultati = db.kategorije[odabranaKategorija]
        .sort((a, b) => (b.ocjena || 0) - (a.ocjena || 0))
        .slice(0, 3);

      return res.status(200).json({
        type: "cards",
        title: `Preporuke (${temp}°C)`,
        subtitle: aiAnaliza.ai_odgovor,
        items: rezultati.map(r => ({
          naziv: r.naziv,
          opis: r.opis,
          ocjena: r.ocjena,
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`,
          lat: r.lat,
          lng: r.lng
        })),
        footer: aiAnaliza.savjet
      });
    }

    // 5. AKO BAŠ NIŠTA NE NAĐE U BAZI (Fallback tekst, ali strukturiran)
    return res.status(200).json({
      type: "text",
      reply: `### ℹ️ Informacija\n${aiAnaliza.ai_odgovor}\n\n💡 **Savjet:** ${aiAnaliza.savjet}`
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ reply: "Sustav trenutno nije dostupan." });
  }
}
