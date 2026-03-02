import express from "express";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import fetch from "node-fetch";

const app = express();
const __dirname = path.resolve();

app.use(express.json());
app.use(express.static(__dirname));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// GLAVNA RUTA ZA CHAT
app.post("/chat", async (req, res) => {
  const { message } = req.body;

  try {
    // 1. DOHVAT VREMENA (Biograd na Moru)
    const weatherRes = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=43.9375&longitude=15.4428&current_weather=true"
    );
    const weatherData = await weatherRes.json();
    const temp = weatherData.current_weather?.temperature || "10.3";

    // 2. UČITAVANJE BAZE (Putanja prilagođena tvojoj strukturi na slici)
    const filePath = path.join(__dirname, "podaci", "biograd_master.json");
    const db = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    // 3. AI KLASIFIKACIJA UPITA
    // AI analizira kontekst i bira kategoriju iz tvog JSON-a
    const kategorijeIzBaze = Object.keys(db.kategorije).join(", ");
    
    const classification = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Ti si mozak turističkog informatora za Biograd. 
          Tvoj zadatak je prepoznati namjeru korisnika i vratiti ključ kategorije iz baze.
          Dostupne kategorije: [${kategorijeIzBaze}].
          
          PRAVILA:
          - Ako korisnik spominje šetnju, park, povijest ili obilazak -> vrati 'atrakcije'.
          - Ako spominje hranu, večeru ili restoran -> vrati 'restorani'.
          - Ako spominje more ili kupanje -> vrati 'plaze'.
          
          Vrati ISKLJUČIVO JSON format: {"category": "ime_kategorije", "uvod": "Kratki uvod od 1 rečenice"}.`
        },
        { role: "user", content: message }
      ],
      response_format: { type: "json_object" }
    });

    const aiRes = JSON.parse(classification.choices[0].message.content);
    const selectedCategory = aiRes.category;

    // 4. GENERIRANJE KARTICA (UX KOJI ŽELIŠ)
    if (selectedCategory && db.kategorije[selectedCategory]) {
      const results = db.kategorije[selectedCategory]
        .sort((a, b) => (b.ocjena || 0) - (a.ocjena || 0))
        .slice(0, 3);

      return res.json({
        type: "cards",
        title: `Preporuke (${temp}°C)`,
        subtitle: aiRes.uvod,
        items: results.map(r => ({
          naziv: r.naziv,
          opis: r.opis,
          ocjena: r.ocjena || "4.5",
          adresa: r.adresa || "Biograd na Moru",
          // Dinamički link za gumb "Otvori na karti"
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`,
          lat: r.lat,
          lng: r.lng
        }))
      });
    }

    // 5. FALLBACK KARTICA (Ako AI ne prepozna specifičnu kategoriju)
    return res.json({
      type: "cards",
      title: "Info kutak",
      items: [{
        naziv: "Istražite Biograd",
        opis: "Trenutno nemam specifične podatke za taj upit, ali preporučujem šetnju rivom i starom jezgrom.",
        ocjena: "5.0",
        adresa: "Obala kralja Petra Krešimira IV",
        mapsUrl: "https://www.google.com/maps/search/?api=1&query=43.9375,15.4428"
      }]
    });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ reply: "Došlo je do pogreške prilikom obrade upita." });
  }
});

// Pokretanje servera (Vercel će ovo ignorirati, ali lokalno ti treba)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
