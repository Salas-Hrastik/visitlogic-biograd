import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  try {
    const { message, userLocation } = req.body;

    const filePath = path.join(process.cwd(), "data", "biograd_master.json");
    const rawData = fs.readFileSync(filePath);
    const data = JSON.parse(rawData);

    // 1️⃣ FLATTEN
    let objekti = [];
    for (const kategorija in data.kategorije) {
      const items = data.kategorije[kategorija];
      if (Array.isArray(items)) {
        items.forEach((item, index) => {
          objekti.push({
            id: `${kategorija}_${index}`,
            kategorija,
            ...item
          });
        });
      }
    }

    // 2️⃣ FILTER KATEGORIJE (deterministički mapping)
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

    // 3️⃣ SORTIRANJE
    results = results
      .filter(o => o.ocjena >= 4.2)
      .sort((a, b) => (b.ocjena || 0) - (a.ocjena || 0))
      .slice(0, 5);

    // 4️⃣ AKO NEMA REZULTATA
    if (results.length === 0) {
      return res.status(200).json({
        success: true,
        reply: "Trenutno nemam dovoljno podataka za taj upit."
      });
    }

    // 5️⃣ GENERIRAJ KONTEKST ZA CHATGPT
    const contextData = results.map(r => `
Naziv: ${r.naziv}
Adresa: ${r.adresa}
Ocjena: ${r.ocjena}
Opis: ${r.opis}
Google Maps: ${r.google_maps}
`).join("\n");

    const prompt = `
Ti si službeni AI turistički informator za Biograd na Moru.

Korisnik pita:
"${message}"

Smiješ koristiti ISKLJUČIVO sljedeće podatke:

${contextData}

Nemoj izmišljati.
Nemoj spominjati druge gradove.
Ako podatak ne postoji, reci da nije dostupan.
Odgovori prirodno, profesionalno i jasno.
`;

    // 6️⃣ POZIV OPENAI
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Ti si profesionalni turistički informator." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3
      })
    });

    const openaiData = await openaiResponse.json();
    const reply = openaiData.choices[0].message.content;

    res.status(200).json({
      success: true,
      reply
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Greška u obradi zahtjeva."
    });
  }
}
