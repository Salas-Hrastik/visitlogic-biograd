import fs from "fs";
import path from "path";
import OpenAI from "openai";

export default async function handler(req, res) {
  // 1. OSIGURANJE METODE I PROVJERA PODATAKA
  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Metoda nije dopuštena." });
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const { message } = req.body;
    if (!message) return res.status(400).json({ reply: "Poruka je prazna." });
    
    const lower = message.toLowerCase();

    // 2. DOHVAT VREMENA (Biograd na Moru - koordinate)
    const weatherRes = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=43.9375&longitude=15.4428&current_weather=true"
    );
    const weatherData = await weatherRes.json();
    const temp = weatherData.current_weather?.temperature || "nepoznato";

    // 3. UČITAVANJE LOKALNE BAZE (biograd_master.json)
    const filePath = path.join(process.cwd(), "data", "biograd_master.json");
    const rawData = fs.readFileSync(filePath);
    const data = JSON.parse(rawData);

    let sviObjekti = [];
    for (const kat in data.kategorije) {
      const stavke = data.kategorije[kat];
      if (Array.isArray(stavke)) {
        stavke.forEach(item => {
          // Napredni scoring: (Ocjena * 3) + (Popularnost / 50)
          const score = ((item.ocjena || 0) * 3) + ((item.broj_ocjena || 0) / 50);
          sviObjekti.push({ kategorija: kat, score, ...item });
        });
      }
    }

    // 4. LOGIKA KATEGORIZACIJE (Ključne riječi)
    let odabranaKategorija = null;
    if (lower.includes("restoran") || lower.includes("jesti") || lower.includes("hrana") || lower.includes("pizz")) {
      odabranaKategorija = "restorani";
    } else if (lower.includes("plaž") || lower.includes("more") || lower.includes("kupanje")) {
      odabranaKategorija = "plaze";
    } else if (lower.includes("kafić") || lower.includes("piti") || lower.includes("kava") || lower.includes("bar")) {
      odabranaKategorija = "barovi";
    }

    // 5. IZRADA ODGOVORA S KARTICAMA (Ako je kategorija pronađena)
    if (odabranaKategorija) {
      const filtriraniRezultati = sviObjekti
        .filter(o => o.kategorija === odabranaKategorija && o.ocjena >= 4.0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      if (filtriraniRezultati.length > 0) {
        return res.status(200).json({
          type: "cards",
          title: `Preporuke za Vas (${temp}°C)`,
          subtitle: `Na temelju Vašeg upita i trenutnog vremena, evo najboljih lokacija:`,
          items: filtriraniRezultati.map(r => ({
            naziv: r.naziv,
            opis: `${r.opis}\n\n⭐ Ocjena: ${r.ocjena}`,
            // Generiranje Google Maps linka preko koordinata
            mapsUrl: `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`,
            lat: r.lat,
            lng: r.lng
          }))
        });
      }
    }

    // 6. AI FALLBACK (Ako nema specifične kategorije ili rezultata)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Ti si digitalni turistički vodič za grad Biograd na Moru. 
          Trenutna temperatura je ${temp}°C. 
          Odgovaraj srdačno, ali strukturirano. Koristi Markdown liste (1., 2., 3.) i bolduj ključne riječi. 
          Uvijek završi s kratkim savjetom vezanim uz trenutnu temperaturu.`
        },
        { role: "user", content: message }
      ],
      temperature: 0.7
    });

    return res.status(200).json({
      type: "text",
      reply: completion.choices[0].message.content,
      weather: temp
    });

  } catch (error) {
    console.error("Greška na serveru:", error);
    return res.status(500).json({ reply: "Trenutno ne mogu obraditi upit. Molim pokušajte kasnije." });
  }
}
