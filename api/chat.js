import OpenAI from "openai";
import fs from "fs";
import path from "path";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {

  try {

    const { message } = req.body;

    // putanja do baze
    const dbPath = path.join(process.cwd(), "data", "biograd_clean.json");

    // provjera postoji li datoteka
    if (!fs.existsSync(dbPath)) {
      return res.status(200).json({
        reply: "Baza podataka nije pronađena."
      });
    }

    // učitaj bazu
    const raw = fs.readFileSync(dbPath, "utf8");
    const data = JSON.parse(raw);

    // filtriranje restorana
    const restorani = data.filter(o =>
      o.kategorija &&
      o.kategorija.toLowerCase().includes("restaurant")
    );

    // priprema konteksta
    const context = JSON.stringify(restorani.slice(0, 20));

    // OpenAI odgovor
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Ti si AI turistički informator za Biograd na Moru.

Ako korisnik pita za restorane koristi ovu bazu:

${context}
`
        },
        {
          role: "user",
          content: message
        }
      ],
      temperature: 0.3
    });

    res.status(200).json({
      reply: completion.choices[0].message.content
    });

  } catch (error) {

    console.error(error);

    res.status(200).json({
      reply: "Greška pri čitanju baze podataka."
    });

  }

}
