import fs from "fs";
import path from "path";
import OpenAI from "openai";

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Method not allowed." });
  }

  try {

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const { message } = req.body;
    const lower = message.toLowerCase();

    // WEATHER
    const weatherRes = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=43.9444&longitude=15.4444&current_weather=true"
    );
    const weatherData = await weatherRes.json();
    const temperature = weatherData.current_weather.temperature;

    // DATABASE
    const filePath = path.join(process.cwd(), "data", "biograd_master.json");
    const rawData = fs.readFileSync(filePath);
    const data = JSON.parse(rawData);

    let objekti = [];

    for (const kategorija in data.kategorije) {
      const items = data.kategorije[kategorija];
      if (Array.isArray(items)) {
        items.forEach(item => {
          const score =
            ((item.ocjena || 0) * 2) +
            ((item.broj_ocjena || 0) / 100);

          objekti.push({
            kategorija,
            score,
            ...item
          });
        });
      }
    }

    let category = null;
    if (lower.includes("restoran")) category = "restorani";
    if (lower.includes("plaž")) category = "plaze";

    if (category) {

      const results = objekti
        .filter(o => o.kategorija === category && o.ocjena >= 4.2)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      return res.status(200).json({
        type: "cards",
        title: `Preporuke (${temperature}°C)`,
        items: results.map(r => ({
          naziv: r.naziv,
          opis: r.opis,
          lat: r.lat,
          lng: r.lng
        }))
      });
    }

    // AI fallback
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Odgovori kratko i strukturirano u 3 točke."
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    return res.status(200).json({
      type: "text",
      reply: completion.choices[0].message.content
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ reply: "Greška servera." });
  }
}
