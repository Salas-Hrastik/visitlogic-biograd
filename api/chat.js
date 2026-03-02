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

    const { conversation } = req.body;

    if (!conversation || !Array.isArray(conversation)) {
      return res.status(400).json({ reply: "Neispravan format razgovora." });
    }

    const lastMessage = conversation[conversation.length - 1].content;
    const m = lastMessage.toLowerCase();

    // 🌤 Vrijeme
    const weatherResponse = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=43.9444&longitude=15.4444&current_weather=true"
    );

    const weatherData = await weatherResponse.json();
    const temperature = weatherData.current_weather.temperature;
    const weatherCode = weatherData.current_weather.weathercode;
    const weatherDescription = interpretWeather(weatherCode);

    // 📂 Minimalna verzija – bez baze (privremeno testiramo komunikaciju)

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Ti si AI turistički asistent za Biograd na Moru."
        },
        ...conversation,
        {
          role: "system",
          content: `Trenutno vrijeme: ${weatherDescription}, ${temperature}°C`
        }
      ]
    });

    return res.status(200).json({
      reply: completion.choices[0].message.content
    });

  } catch (error) {
    console.error("SERVER ERROR:", error);
    return res.status(500).json({
      reply: "Greška servera."
    });
  }
}
