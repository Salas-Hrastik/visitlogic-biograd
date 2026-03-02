import fs from "fs";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const { message } = req.body;

    // 🌤 DOHVAT VREMENA (Open-Meteo)
    const weatherResponse = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=43.9444&longitude=15.4444&current_weather=true"
    );

    const weatherData = await weatherResponse.json();
    const temperature = weatherData.current_weather.temperature;
    const weatherCode = weatherData.current_weather.weathercode;

    const filePath = path.join(process.cwd(), "data", "biograd_master.json");
    const rawData = fs.readFileSync(filePath);
    const data = JSON.parse(rawData);

    let objekti = [];

    for (const kategorija in data.kategorije) {
      const items = data.kategorije[kategorija];
      if (Array.isArray(items)) {
        items.forEach(item => {
          objekti.push({
            kategorija,
            ...item
          });
        });
      }
    }

    const categoryMap = {
      restoran: "restorani",
      večera: "restorani",
      ručak: "restorani",
      plaža: "plaze",
      djeca: "djecji_sadrzaji",
      ljekarna: "ljekarne",
      hotel: "hoteli"
    };

    let detectedCategory = null;

    for (const keyword in categoryMap) {
      if (message.toLowerCase().includes(keyword)) {
        detectedCategory = categoryMap[keyword];
        break;
      }
    }

    let results = objekti;

    if (detectedCategory) {
      results = objekti.filter(o => o.kategorija === detectedCategory);
    }

    results = results
      .filter(o => o.ocjena >= 4.2)
      .sort((a, b) => (b.ocjena || 0) - (a.ocjena || 0))
      .slice(0, 5);

    const contextData = results.map(r => `
Naziv: ${r.naziv}
Adresa: ${r.adresa}
Ocjena: ${r.ocjena}
Opis: ${r.opis}
Google Maps: ${r.google_maps}
`).join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
Ti si službeni turistički informator za Biograd na Moru.

Trenutna temperatura: ${temperature}°C
Weather code: ${weatherCode}

Ako je vrijeme sunčano i toplo → potičeš vanjske aktivnosti.
Ako pada kiša → predlažeš zatvorene sadržaje (restorani, muzeji).
Uvijek koristi isključivo dostavljene podatke.
Ne izmišljaj.
`
        },
        {
          role: "user",
          content: `
Korisnik pita: "${message}"

Dostupni podaci:

${contextData}
`
        }
      ]
    });

    res.status(200).json({
      reply: completion.choices[0].message.content
    });

  } catch (error) {
    console.error("SERVER ERROR:", error);
    res.status(500).json({
      reply: "Greška servera."
    });
  }
}
