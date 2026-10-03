export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "POST only"
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY missing"
      });
    }

    const message = req.body?.message;

    if (!message) {
      return res.status(400).json({
        error: "Message missing"
      });
    }

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are a helpful sales assistant for KIKT Software Solutions.

Customer says:
${message}

Understand the requirement naturally and reply in simple Tamil/Tanglish.
Do not invent prices.
If they want software to manage leads and convert leads into sales, understand that requirement and ask one useful next question.`
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: "Gemini Error",
        status: response.status,
        details: data
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      return res.status(500).json({
        error: "No Gemini reply",
        details: data
      });
    }

    return res.status(200).json({
      reply: reply
    });

  } catch (error) {
    return res.status(500).json({
      error: "Server Error",
      message: error.message
    });
  }
}
