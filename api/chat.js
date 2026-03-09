import OpenAI from "openai";
import fs from "fs";
import path from "path";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  try {
    const { message } = req.body;

    const filePath = path.join(process.cwd(), "data", "biograd_master.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);

    const restorani = data.restorani || [];

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
