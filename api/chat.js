import fs from "fs";
import path from "path";
import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ reply: "Method not allowed." });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { message } = req.body;
    const lower = message.toLowerCase();

    // 1. VRIJEME
    const weatherRes = await fetch("https://api.open-meteo.com/v1/forecast?latitude=43.9375&longitude=15.4428&current_weather=true");
    const weatherData = await weatherRes.json();
    const temp = weatherData.current_weather?.temperature || "15";

    // 2. BAZA PODATAKA
    const filePath = path.join(process.cwd(), "data", "biograd_master.json");
    const rawData = fs.readFileSync(filePath);
    const data = JSON.parse(rawData);

    // 3. DETEKCIJA KATEGORIJE (UX Trigger)
    let category = null;
    if (lower.includes("restoran") || lower.includes("hrana")) category = "restorani";
    if (lower.includes("plaž") || lower.includes("more")) category = "plaze";
    if (lower.includes("šetnj") || lower.includes("znamenitost") || lower.includes("obići")) category = "atrakcije";

    // AKO JE KATEGORIJA PREPOZNATA -> ŠALJEMO KARTICE (Ovo eliminira tekstualni blok)
    if (category && data.kategorije[category]) {
      const items = data.kategorije[category]
        .filter(i => i.ocjena >= 4.0)
        .sort((a, b) => b.ocjena - a.ocjena)
        .slice(0, 3);

      return res.status(200).json({
        type: "cards",
        title: `📍 Preporuke za: ${category.toUpperCase()}`,
        temp: `${temp}°C`,
        items: items.map(item => ({
          naziv: item.naziv,
          opis: `⭐ ${item.ocjena} | ${item.opis}`,
          link: `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`
        }))
      });
    }

    // 4. AI FALLBACK (Samo ako nema podudaranja u bazi)
    // STROGO naređujemo AI-ju da koristi Markdown liste i razmake
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Ti si turistički vodič. Govoriš kratko. 
          MAX 3 točke. 
          Obavezno koristi prazan red između točaka. 
          Koristi emojije.
          Format:
          ### [Naslov]
          - [Kratki opis]
          
          ### [Naslov]`
        },
        { role: "user", content: `Vrijeme je ${temp}°C. Upit: ${message}` }
      ],
      temperature: 0.3 // Niža temperatura = manje "brbljanja"
    });

    // Vraćamo tekst, ali frontend ga mora renderirati kao Markdown
    return res.status(200).json({
      type: "text",
      reply: completion.choices[0].message.content
    });

  } catch (error) {
    return res.status(500).json({ reply: "Greška na serveru." });
  }
}
