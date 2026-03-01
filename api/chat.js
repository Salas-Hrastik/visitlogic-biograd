import fs from "fs";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {

  // DOZVOLJAVAMO SAMO POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        reply: "API ključ nije postavljen."
      });
    }

    const { message } = req.body;

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
      pizza: "restorani",
      plaža: "plaze",
      djeca: "djecji_sadrzaji",
      rent: "rent_a_car",
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
      .sort((a, b) => (b.ocjena || 0) - (a.ocjena || 0))
      .slice(0, 5);

    if (results.length === 0) {
      return res.status(200).json({
        reply: "Trenutno nemam dovoljno podataka za taj upit."
      });
    }

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
          content: "Ti si službeni turistički informator za Biograd na Moru. Koristi isključivo dostavljene podatke."
        },
        {
          role: "user",
          content: `
Korisnik pita: "${message}"

Smiješ koristiti isključivo sljedeće podatke:

${contextData}

Ne izmišljaj.
Ne spominji druge gradove.
Ako nešto nije dostupno, reci da nema podataka.
Odgovori profesionalno.
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
      reply: "Server greška – provjerite Vercel log."
    });
  }
}
