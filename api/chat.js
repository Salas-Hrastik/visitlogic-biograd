import fs from "fs";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function interpretWeather(code) {

  if ([0].includes(code)) return "sunčano";
  if ([1,2,3].includes(code)) return "djelomično oblačno";
  if ([45,48].includes(code)) return "magla";
  if ([51,53,55,61,63,65].includes(code)) return "kiša";
  if ([95,96,99].includes(code)) return "nevrijeme";

  return "nepoznato";
}

export default async function handler(req, res) {

  try {

    const { conversation } = req.body || {};

    const userMessage =
      conversation?.[conversation.length - 1]?.content || "";

    const lowerMessage = userMessage.toLowerCase();



    // 🌤 VRIJEME BIOGRAD

    const weatherResponse = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=43.9444&longitude=15.4444&current_weather=true"
    );

    const weatherData = await weatherResponse.json();

    const temperatura =
      weatherData.current_weather.temperature;

    const weatherDescription =
      interpretWeather(weatherData.current_weather.weathercode);



    // 📁 BAZA PODATAKA

    const filePath = path.join(
      process.cwd(),
      "podaci",
      "biograd_master.json"
    );

    const rawData = fs.readFileSync(filePath);

    const podaci = JSON.parse(rawData);



    // 🧠 OBJEKTI

    let objekti = [];

    for (const kategorija in podaci.kategorije) {

      const items = podaci.kategorije[kategorija];

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

    let category = null;

    if (
      lowerMessage.includes("restoran") ||
      lowerMessage.includes("ručak") ||
      lowerMessage.includes("večera")
    ) category = "restorani";

    if (
      lowerMessage.includes("hotel") ||
      lowerMessage.includes("smještaj")
    ) category = "smjestaj";

    if (
      lowerMessage.includes("ljekarna") ||
      lowerMessage.includes("apotek")
    ) category = "ljekarne";

    if (
      lowerMessage.includes("plaža")
    ) category = "plaze";



    // 📊 STRUKTURIRANI ODGOVOR

    if (category) {

      const results =
        objekti
          .filter(o => o.kategorija === category)
          .sort((a,b) => b.score - a.score)
          .slice(0,3);

      return res.json({

        type: "cards",

        title:
          `Preporuke (${weatherDescription}, ${temperatura}°C)`,

        items:
          results.map(r => ({

            naziv: r.naziv,
            adresa: r.adresa,
            opis: r.opis,
            ocjena: r.ocjena,

            lat: r.lat || null,
            lng: r.lng || null,

            web: r.web || null

          }))

      });

    }



    // 🤖 AI ODGOVOR

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4o-mini",

        temperature: 0.3,

        messages: [

          {
            role: "system",
            content:
`Ti si profesionalni turistički informator grada Biograda na Moru.

Odgovaraj kratko i jasno.

Daj konkretne preporuke za:
- plaže
- restorane
- znamenitosti
- aktivnosti

Uvijek uzmi u obzir vrijeme.`
          },

          {
            role: "user",
            content:
`${userMessage}

Vrijeme u Biogradu:
${weatherDescription}, ${temperatura}°C`
          }

        ]

      });


    return res.json({

      reply:
        completion.choices[0].message.content

    });


  }

  catch(error) {

    console.error(error);

    return res.status(500).json({

      reply:
        "Greška u komunikaciji sa serverom."

    });

  }

}
