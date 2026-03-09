import OpenAI from "openai";
import fs from "fs";
import path from "path";  // dodaj ovo

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  try {
    const { message } = req.body;

    // ispravan path koji radi na Vercelу
    const filePath = path.join(process.cwd(), "data", "biograd_master.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);

    const restorani = data.filter(o =>
      o.kategorija &&
      o.kategorija.toLowerCase().includes("restaurant")
    );

    const context = JSON.stringify(restorani.slice(0, 20));

    // ... ostatak ostaje isti
