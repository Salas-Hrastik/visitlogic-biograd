import fs from "fs";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function interpretWeather(code) {
  if ([0].includes(code)) return "sunčano";
  if ([1, 2, 3].includes(code)) return "djelomično oblačno";
  if ([45, 48].includes(code)) return "magla";
  if ([51, 53, 55, 61, 63, 65].includes(code)) return "kiša";
  if ([95, 96, 99].includes(code)) return "nevrijeme";
  return "nepoznato";
}

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Method not allowed." });
  }

  try {

    const { conversation } = req.body;

    if (!conversation || !Array.isArray(conversation)) {
      return res.status(400).json({ reply: "Neispravan format razgovora." });
    }

    const lastMessage = conversation[conversation.length - 1].content;
    const m = lastMessage.toLowerCase();

    // 🌤 Vrijeme
    const weatherResponse = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=43.9444&longitude=15.4444&current_weather=true"
    );

    const weatherData = await weatherResponse.json();
    const temperature = weatherData.current_weather.temperature;
    const weatherCode = weatherData.current_weather.weathercode;
    const weatherDescription = interpretWeather(weatherCode);

    // 📂 Učitavanje baze
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

    // 🔎 Intent
    let detectedCategory = null;

    if (m.includes("ljekarn") || m.includes("apotek")) {
      detectedCategory = "ljekarne";
    }
    else if (m.includes("plaž")) {
      detectedCategory = "plaze";
    }
    else if (m.includes("restoran") || m.includes("ručak") || m.includes("večer")) {
      detectedCategory = "restorani";
    }
    else if (m.includes("hotel") || m.includes("smještaj")) {
      detectedCategory = "smjestaj";
    }
    else if (m.includes("izlet") || m.includes("kornat")) {
      detectedCategory = "izleti_i_avantura";
    }

    let results = objekti;

    if (detectedCategory) {
      results = objekti.filter(o => o.kategorija === detectedCategory);
    }

    results = results
      .filter(o => o.ocjena >= 4.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (results.length === 0) {
      return res.status(200).json({
        reply: "Trenutno nemam verificirane podatke za taj upit."
      });
    }

    const formattedData = results.map(r => `
Naziv: ${r.naziv}
Adresa: ${r.adresa}
Ocjena: ${r.ocjena}
Opis: ${r.opis}
Google Maps: ${r.google_maps}
${r.web ? `Web: ${r.web}` : ""}
`).join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
Ti si destinacijski AI asistent za Biograd na Moru.

OBAVEZNO:
- Koristi isključivo dostavljene objekte.
- Nikada ne izmišljaj nove restorane.
- Ne miješaj kategorije.
- Ako korisnik specificira jedan objekt, fokusiraj se samo na njega.
- Uvijek uključi Google Maps link.
`
        },
        ...conversation,
        {
          role: "system",
          content: `
Kontekst:
Vrijeme: ${weatherDescription}, ${temperature}°C

Dostupni objekti:
${formattedData}
`
        }
      ]
    });

    return res.status(200).json({
      reply: completion.choices[0].message.content
    });

  } catch (error) {
    console.error("SERVER ERROR:", error);
    return res.status(500).json({
      reply: "Greška servera."
    });
  }
}
