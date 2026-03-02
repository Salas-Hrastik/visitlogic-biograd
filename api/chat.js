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

    // 🕒 Dio dana
    const now = new Date();
    const hour = now.getHours();
    let partOfDay = "dan";
    if (hour < 11) partOfDay = "jutro";
    else if (hour >= 18) partOfDay = "večer";

    // 📂 Baza
    const filePath = path.join(process.cwd(), "data", "biograd_master.json");
    const rawData = fs.readFileSync(filePath);
    const data = JSON.parse(rawData);

    let objekti = [];

    for (const kategorija in data.kategorije) {
      const items = data.kategorije[kategorija];
      if (Array.isArray(items)) {
        items.forEach(item => {
          const score =
            ((item.ocjena || 0) * 2) +
            ((item.broj_ocjena || 0) / 100);

          objekti.push({
            kategorija,
            score,
            ...item
          });
        });
      }
    }

    // 🔎 Intent
    let detectedCategory = null;

    if (m.includes("ljekarn") || m.includes("apotek")) {
      detectedCategory = "ljekarne";
    }
    else if (m.includes("plaž")) {
      detectedCategory = "plaze";
    }
    else if (m.includes("restoran") || m.includes("ručak") || m.includes("večer")) {
      detectedCategory = "restorani";
    }
    else if (m.includes("hotel") || m.includes("smještaj")) {
      detectedCategory = "smjestaj";
    }
    else if (m.includes("izlet") || m.includes("kornat")) {
      detectedCategory = "izleti_i_avantura";
    }

    let results = objekti;

    if (detectedCategory) {
      results = objekti.filter(o => o.kategorija === detectedCategory);
    }

    results = results
      .filter(o => o.ocjena >= 4.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const formattedData = results.map(r => `
Naziv: ${r.naziv}
Adresa: ${r.adresa}
Ocjena: ${r.ocjena}
Opis: ${r.opis}
Google Maps: ${r.google_maps}
${r.web ? `Web: ${r.web}` : ""}
`).join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
Ti si strateški destinacijski AI asistent za Biograd na Moru.
Odgovaraj stručno, koncizno i analitički.
Ne ponavljaj iste liste ako korisnik specificira objekt.
Ako korisnik odabere konkretan objekt, fokusiraj se samo na njega.
`
        },
        ...conversation,
        {
          role: "user",
          content: `
Kontekst:
Vrijeme: ${weatherDescription}, ${temperature}°C
Dio dana: ${partOfDay}

Dostupni objekti:
${formattedData}
`
        }
      ]
    });

    res.status(200).json({
      reply: completion.choices[0].message.content
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      reply: "Greška servera."
    });
  }
}
