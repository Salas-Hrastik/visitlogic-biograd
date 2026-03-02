import fs from "fs";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function interpretWeather(code) {
  if ([0].includes(code)) return "sunčano";
  if ([1,2,3].includes(code)) return "djelomično oblačno";
  if ([45,48].includes(code)) return "magla";
  if ([51,53,55,61,63,65].includes(code)) return "kiša";
  if ([95,96,99].includes(code)) return "nevrijeme";
  return "nepoznato";
}

function parseActivities(text) {

  const lines = text
    .replace(/\*\*/g, "")
    .replace(/#+/g, "")
    .split(/\d+\./)
    .map(l => l.trim())
    .filter(l => l.length > 10)
    .slice(0,3);

  return lines.map(line => {

    const parts = line.split(":");

    return {
      naziv: parts[0]?.trim() || "Prijedlog",
      opis: parts.slice(1).join(":").trim() || line,
      ikona: "📍"
    };
  });
}

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Method not allowed." });
  }

  try {

    const { conversation } = req.body;
    const userMessage =
      conversation?.[conversation.length - 1]?.content || "";

    const lowerMessage = userMessage.toLowerCase();

    // WEATHER
    const weatherResponse = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=43.9444&longitude=15.4444&current_weather=true"
    );

    const weatherData = await weatherResponse.json();
    const temperature = weatherData.current_weather.temperature;
    const weatherDescription =
      interpretWeather(weatherData.current_weather.weathercode);

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

    if (lowerMessage.includes("restoran")) category = "restorani";
    if (lowerMessage.includes("plaž")) category = "plaze";

    if (category) {

      const results = objekti
        .filter(o => o.kategorija === category && o.ocjena >= 4.2)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      return res.status(200).json({
        type: "cards",
        title: `Preporuke (${weatherDescription}, ${temperature}°C)`,
        items: results.map(r => ({
          naziv: r.naziv,
          opis: r.opis,
          lat: r.lat || null,
          lng: r.lng || null,
          ikona: "📍"
        }))
      });
    }

    // AI GENERATION
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
Daj maksimalno 3 prijedloga aktivnosti.
Numeriraj ih 1., 2., 3.
Svaki prijedlog u jednoj kraćoj rečenici.
Bez eseja.
`
        },
        {
          role: "user",
          content: `
Upit: ${userMessage}
Vrijeme: ${weatherDescription}, ${temperature}°C
`
        }
      ]
    });

    const rawText = completion.choices[0].message.content;

    const activities = parseActivities(rawText);

    return res.status(200).json({
      type: "ai_cards",
      title: `Prijedlog aktivnosti (${weatherDescription}, ${temperature}°C)`,
      items: activities
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ reply: "Greška servera." });
  }
}
