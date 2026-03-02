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

    const { message } = req.body;

    // 🌤 DOHVAT TRENUTNOG VREMENA
    const weatherResponse = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=43.9444&longitude=15.4444&current_weather=true"
    );

    const weatherData = await weatherResponse.json();
    const temperature = weatherData.current_weather.temperature;
    const weatherCode = weatherData.current_weather.weathercode;
    const weatherDescription = interpretWeather(weatherCode);

    // 🕒 DIO DANA
    const now = new Date();
    const hour = now.getHours();
    let partOfDay = "dan";
    if (hour < 11) partOfDay = "jutro";
    else if (hour >= 18) partOfDay = "večer";

    // 📂 UČITAVANJE BAZE
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

    // 🔎 DETEKCIJA KATEGORIJE
    const categoryMap = {
      restoran: "restorani",
      večera: "restorani",
      ručak: "restorani",
      pizza: "restorani",
      plaža: "plaze",
      djeca: "djecji_sadrzaji",
      ljekarna: "ljekarne",
      hotel: "hoteli",
      apartman: "apartmani",
      kamp: "kampovi"
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
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (results.length === 0) {
      return res.status(200).json({
        reply: "Nemam dostupne podatke za taj upit u Biogradu."
      });
    }

    const contextData = results.map(r => `
Naziv: ${r.naziv}
Adresa: ${r.adresa}
Ocjena: ${r.ocjena}
Opis: ${r.opis}
Google Maps: ${r.google_maps}
`).join("\n");

    // 🤖 OPENAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
Ti si službeni turistički informator za Biograd na Moru.

Trenutno vrijeme: ${weatherDescription}, ${temperature}°C.
Dio dana: ${partOfDay}.

Ako je kiša ili nevrijeme → predlaži zatvorene aktivnosti.
Ako je sunčano i toplo → predlaži vanjske aktivnosti.

Koristi ISKLJUČIVO dostavljene podatke.
Nikada ne spominji druge gradove.
Ako nema podataka, jasno reci da nema.
`
        },
        {
          role: "user",
          content: `
Korisnik pita: "${message}"

Dostupni objekti:

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
      reply: "Greška servera – provjerite Vercel log."
    });
  }
}
