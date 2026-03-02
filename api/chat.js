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
    const m = message.toLowerCase();

    // 🌤 DOHVAT VREMENA
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

    // 🔎 DETEKCIJA NAMJERE (PRIORITET EKSPPLICITNOG UPITA)
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
    else if (m.includes("kava") || m.includes("doručak") || m.includes("kafić")) {
      detectedCategory = "slasticarnice";
    }
    else if (m.includes("hotel")) {
      detectedCategory = "hoteli";
    }
    else if (m.includes("apartman")) {
      detectedCategory = "apartmani";
    }
    else if (m.includes("kamp")) {
      detectedCategory = "kampovi";
    }

    // 🧠 KONTEKST DIJELA DANA VRIJEDI SAMO AKO NEMA EKSPPLICITNE KATEGORIJE
    if (!detectedCategory) {
      if (partOfDay === "jutro") {
        detectedCategory = "slasticarnice";
      }
      else if (partOfDay === "večer") {
        detectedCategory = "restorani";
      }
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
        reply: "Nemam dostupne podatke za taj upit u Biogradu."
      });
    }

    // 📎 OBAVEZNI LINKOVI
    const formattedData = results.map(r => `
Naziv: ${r.naziv}
Adresa: ${r.adresa}
Ocjena: ${r.ocjena}
Opis: ${r.opis}
Google Maps: ${r.google_maps}
${r.web ? `Web: ${r.web}` : ""}
`).join("\n");

    // 🤖 OPENAI GENERACIJA
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
Ti si službeni turistički informator za Biograd na Moru.

Trenutno vrijeme: ${weatherDescription}, ${temperature}°C.
Dio dana: ${partOfDay}.

Uvijek:
- koristi isključivo dostavljene objekte
- prikaži Google Maps link
- ako postoji web stranica, prikaži i web link
- nikada ne spominji druge gradove
- ne izmišljaj podatke
`
        },
        {
          role: "user",
          content: `
Korisnik pita: "${message}"

Dostupni objekti:

${formattedData}
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
