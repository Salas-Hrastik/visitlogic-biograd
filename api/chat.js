import OpenAI from "openai";
import fs from "fs";
import path from "path";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
import OpenAI from "openai";
import fs from "fs";
import path from "path";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
    try {
          const { message } = req.body;

          const filePath = path.join(process.cwd(), "data", "biograd_osm.json");
          const raw = fs.readFileSync(filePath, "utf8");

          let data;
          try {
                  data = JSON.parse(raw);
          } catch(e) {
                  const lastBrace = raw.lastIndexOf('}');
                  data = JSON.parse(raw.substring(0, lastBrace + 1));
          }

          const elements = data.elements || [];
          const restorani = elements
            .filter(e => e.tags && ['restaurant','cafe','bar','fast_food','pub'].includes(e.tags.amenity) && e.tags.name)
            .map(e => ({ naziv: e.tags.name, tip: e.tags.amenity, kuhinja: e.tags.cuisine || null }));

          const context = JSON.stringify(restorani.slice(0, 20));

          const completion = await openai.chat.completions.create({
                  model: "gpt-4o-mini",
                  messages: [
                    { role: "system", content: `Ti si AI turisticki informator za Biograd na Moru.\n\nAko korisnik pita za restorane koristi ovu bazu:\n\n${context}` },
                    { role: "user", content: message }
                          ],
                  temperature: 0.3
          });

          res.status(200).json({ reply: completion.choices[0].message.content });

    } catch (error) {
          console.error(error);
          res.status(200).json({ reply: "GRESKA: " + error.message });
    }
}
});

export default async function handler(req, res) {
  try {
    const { message } = req.body;

    const filePath = path.join(process.cwd(), "data", "biograd_osm.json");
    const raw = fs.readFileSync(filePath, "utf8");
    let data; try { data = JSON.parse(raw); } catch(e) { data = JSON.parse(raw.substring(0, raw.lastIndexOf('\n}') + 2)); }
const elements = data.elements || []; const restorani = elements.filter(e => e.tags && ['restaurant','cafe','bar','fast_food','pub'].includes(e.tags.amenity) && e.tags.name).map(e => ({ naziv: e.tags.name, tip: e.tags.amenity, kuhinja: e.tags.cuisine || null }));
    
    const context = JSON.stringify(restorani.slice(0, 20));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Ti si AI turistički informator za Biograd na Moru.\n\nAko korisnik pita za restorane koristi ovu bazu:\n\n${context}`
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
      reply: "Greška pri dohvaćanju podataka."
    });
  }
}
