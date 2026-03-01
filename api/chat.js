import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ odgovor: "API radi ✅ (pošalji POST zahtjev)" });
  }

  try {
    const { message } = req.body;

    // 📚 1️⃣ UČITAVANJE DESTINACIJSKE BAZE
    const filePath = path.join(process.cwd(), "data", "biograd.json");
    const rawData = fs.readFileSync(filePath, "utf-8");
    const biogradData = JSON.parse(rawData);

    // 🌦️ 2️⃣ DOHVAT REALNOG VREMENA (Open-Meteo)
    let temperature = null;
    let windspeed = null;
    let weathercode = null;

    try {
      const weatherResponse = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=43.937&longitude=15.451&current_weather=true"
      );

      const weatherData = await weatherResponse.json();

      temperature = weatherData.current_weather?.temperature ?? null;
      windspeed = weatherData.current_weather?.windspeed ?? null;
      weathercode = weatherData.current_weather?.weathercode ?? null;
    } catch (weatherError) {
      console.error("Greška kod dohvaćanja vremena:", weatherError);
    }

    // 📅 3️⃣ SEZONSKA LOGIKA
    const currentMonth = new Date().getMonth() + 1;

    let season = "izvan sezone";
    if (currentMonth >= 7 && currentMonth <= 8) season = "sezona kupanja";
    else if (currentMonth >= 4 && currentMonth <= 6) season = "prijelazno razdoblje";
    else if (currentMonth >= 9 && currentMonth <= 10) season = "mirnija posezona";

    // 🧠 4️⃣ SYSTEM PROMPT
    const systemPrompt = `
Ti si službeni digitalni turistički informator za Biograd na Moru.

--------------------------------------------------
SLUŽBENA DESTINACIJSKA BAZA PODATAKA
--------------------------------------------------
${JSON.stringify(biogradData, null, 2)}

--------------------------------------------------
REALNI UVJETI
--------------------------------------------------
Temperatura: ${temperature ?? "nepoznato"} °C
Brzina vjetra: ${windspeed ?? "nepoznato"} km/h
Weather code: ${weathercode ?? "nepoznato"}
Sezona: ${season}

--------------------------------------------------
PRAVILA
--------------------------------------------------
- Koristi ISKLJUČIVO podatke iz baze.
- Ne izmišljaj objekte.
- Ako informacija nije u bazi, jasno reci da nije dostupna.
- Maksimalno 3 preporuke.
- Najviše jedno potpitanje.
- Profesionalno, jasno i toplo.

Hijerarhija:
REALNI UVJETI → SEZONA → PREPORUKA → ATMOSFERA
`;

    // 🤖 5️⃣ POZIV OPENAI API-JA
    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
          ],
          temperature: 0.3
        }),
      }
    );

    const data = await openaiResponse.json();

    const aiReply =
      data.choices?.[0]?.message?.content ||
      "Trenutno nije moguće generirati odgovor.";

    return res.status(200).json({
      odgovor: aiReply
    });

  } catch (error) {
    console.error("Greška:", error);
    return res.status(500).json({
      odgovor: "Došlo je do pogreške u sustavu."
    });
  }
}
