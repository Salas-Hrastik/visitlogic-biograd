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
    const lastMessage = conversation?.[0]?.content?.toLowerCase() || "";

    // 🌤 Vrijeme
    const weatherResponse = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=43.9444&longitude=15.4444&current_weather=true"
    );
    const weatherData = await weatherResponse.json();
    const temperature = weatherData.current_weather.temperature;
    const weatherDescription = interpretWeather(weatherData.current_weather.weathercode);

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

    if (lastMessage.includes("ljekarn")) detectedCategory = "ljekarne";
    else if (lastMessage.includes("plaž")) detectedCategory = "plaze";
    else if (lastMessage.includes("restoran") || lastMessage.includes("ručak")) detectedCategory = "restorani";
    else if (lastMessage.includes("hotel") || lastMessage.includes("smještaj")) detectedCategory = "smjestaj";
    else if (lastMessage.includes("izlet")) detectedCategory = "izleti_i_avantura";

    if (detectedCategory) {

      const results = objekti
        .filter(o => o.kategorija === detectedCategory && o.ocjena >= 4.2)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      return res.status(200).json({
        type: "cards",
        title: `Preporučeni ${detectedCategory}`,
        items: results.map(r => ({
          naziv: r.naziv,
          adresa: r.adresa,
          ocjena: r.ocjena,
          opis: r.opis,
          google_maps: r.google_maps,
          web: r.web || null
        }))
      });
    }

    // GPT samo za opće upite
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "Ti si profesionalni turistički informator za Biograd na Moru."
        },
        {
          role: "user",
          content: `Upit: ${lastMessage}. Trenutno vrijeme: ${weatherDescription}, ${temperature}°C`
        }
      ]
    });

    return res.status(200).json({
      reply: completion.choices[0].message.content
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      reply: "Greška servera."
    });
  }
}
