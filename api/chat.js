export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ odgovor: "API radi ✅ (pošalji POST zahtjev)" });
  }

  try {
    const { message } = req.body;

    // 🌦️ 1. DOHVAT REALNOG VREMENA (Open-Meteo)
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

    // 📅 2. SEZONSKA LOGIKA
    const currentMonth = new Date().getMonth() + 1;

    let season = "izvan sezone";
    if (currentMonth >= 7 && currentMonth <= 8) season = "sezona kupanja";
    else if (currentMonth >= 4 && currentMonth <= 6) season = "prijelazno razdoblje";
    else if (currentMonth >= 9 && currentMonth <= 10) season = "mirnija posezona";

    // 🧠 3. SYSTEM PROMPT S REALNIM UVJETIMA
    const systemPrompt = `
Ti si službeni digitalni turistički informator za Biograd na Moru.

--------------------------------------------------
REALNI UVJETI (trenutni podaci)
--------------------------------------------------
Temperatura: ${temperature ?? "nepoznato"} °C
Brzina vjetra: ${windspeed ?? "nepoznato"} km/h
Weather code: ${weathercode ?? "nepoznato"}
Sezona: ${season}

--------------------------------------------------
PRAVILA
--------------------------------------------------

Hijerarhija odgovora:
REALNI UVJETI → SEZONA → FUNKCIONALNA PREPORUKA → ATMOSFERA

Ako je weathercode >= 51:
- ne predlaži plažu

Ako je temperatura < 18°C:
- kupanje nije primarna preporuka

Ako je temperatura > 30°C:
- preporuči jutarnje i večernje aktivnosti

Ako je windspeed > 35 km/h:
- naglasi oprez kod nautike

Ako je windspeed > 45 km/h:
- ne preporučuj izlet brodom

Izvan sezone ne pretpostavljaj kupanje kao glavnu aktivnost.

Maksimalno 3 preporuke.
Najviše jedno potpitanje.
Bez izmišljanja objekata.
Profesionalno, jasno i toplo.
`;

    // 🤖 4. POZIV OPENAI API-JA
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
            { role: "user", content: message },
          ],
          temperature: 0.4,
        }),
      }
    );

    const data = await openaiResponse.json();

    const aiReply =
      data.choices?.[0]?.message?.content ||
      "Trenutno nije moguće generirati odgovor.";

    return res.status(200).json({
      odgovor: aiReply,
    });

  } catch (error) {
    console.error("Greška:", error);
    return res.status(500).json({
      odgovor: "Došlo je do pogreške u sustavu.",
    });
  }
}
