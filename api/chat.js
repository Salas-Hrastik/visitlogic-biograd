export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ odgovor: "API radi ✅ (pošalji POST zahtjev)" });
  }

  try {
    const { message } = req.body;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: "Ti si digitalni turistički informator za Biograd na Moru. Odgovaraj kratko, jasno i korisno."
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.7
      }),
    });

    const data = await response.json();

    res.status(200).json({
      odgovor: data.choices?.[0]?.message?.content || "Nema odgovora"
    });

  } catch (error) {
    res.status(500).json({ error: "Greška servera", detalji: error.message });
  }
}
