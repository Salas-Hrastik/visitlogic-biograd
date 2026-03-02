import fs from "fs";
import path from "path";
import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Metoda nije dopuštena." });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { message } = req.body;
    if (!message) return res.status(400).json({ reply: "Poruka je prazna." });
    
    const lower = message.toLowerCase();

    // 1. DOHVAT VREMENA
    const weatherRes = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=43.9375&longitude=15.4428&current_weather=true"
    );
    const weatherData = await weatherRes.json();
    const temp = weatherData.current_weather?.temperature || "nepoznato";

    // 2. LOKALNA BAZA (JSON)
    const filePath = path.join(process.cwd(), "data", "biograd_master.json");
    const rawData = fs.readFileSync(filePath);
    const data = JSON.parse(rawData);

    let sviObjekti = [];
    for (const kat in data.kategorije) {
      if (Array.isArray(data.kategorije[kat])) {
        data.kategorije[kat].forEach(item => {
          const score = ((item.ocjena || 0) * 3) + ((item.broj_ocjena || 0) / 50);
          sviObjekti.push({ kategorija: kat, score, ...item });
        });
      }
    }

    // 3. LOGIKA KATEGORIZACIJE (Restorani, Plaže, Barovi)
    let odabranaKategorija = null;
    if (lower.includes("restoran") || lower.includes("hrana") || lower.includes("jesti")) odabranaKategorija = "restorani";
    else if (lower.includes("plaž") || lower.includes("kupanje")) odabranaKategorija = "plaze";
    else if (lower.includes("kafić") || lower.includes("piti") || lower.includes("bar")) odabranaKategorija = "barovi";

    if (odabranaKategorija) {
      const rezultati = sviObjekti
        .filter(o => o.kategorija === odabranaKategorija && o.ocjena >= 4.0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      if (rezultati.length > 0) {
        return res.status(200).json({
          type: "cards",
          title: `📍 Najbolje lokacije (${temp}°C)`,
          items: rezultati.map(r => ({
            naziv: r.naziv,
            opis: `⭐ **Ocjena: ${r.ocjena}**\n${r.opis}`,
            mapsUrl: `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`,
            lat: r.lat,
            lng: r.lng
          }))
        });
      }
    }

    // 4. AI FALLBACK - KLJUČ ZA BOLJI UX
    // Umjesto dugih rečenica, forsiramo strogu Markdown strukturu
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Ti si digitalni vodič za Biograd. Tvoj odgovor mora biti vrhunski pregledan (UX dizajn).
          Trenutna temperatura: ${temp}°C.
          
          Pravila formatiranja:
          1. Koristi naslove (###) za svaku lokaciju/prijedlog.
          2. Koristi Emojije na početku svakog naslova.
          3. Koristi Bullet pointe (-) za detalje.
          4. Svaki prijedlog odvoji vodoravnom crtom (---).
          5. Na kraju dodaj kratak "Savjet dana" s obzirom na temperaturu.`
        },
        { role: "user", content: message }
      ],
      temperature: 0.5
    });

    return res.status(200).json({
      type: "text",
      reply: completion.choices[0].message.content
    });

  } catch (error) {
    return res.status(500).json({ reply: "Sustav je trenutno nedostupan." });
  }
}
