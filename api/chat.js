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
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

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
                text: `You are a helpful AI sales and support assistant for KIKT Software Solutions.

Customer message:
${message}

Understand what the customer means naturally.

The customer may speak:
- Tamil
- Tanglish
- English
- mixed Tamil and English
- speech-to-text with spelling mistakes

Reply naturally in simple conversational Tamil/Tanglish unless the customer clearly prefers English.

Do not ask questions that the customer has already answered.

If the customer gives multiple requirements in one message, understand all of them.

If the customer says they want software to manage leads and convert leads into sales, understand this as a lead management + sales follow-up requirement.

Ask only ONE useful next question when more information is needed.

Do not invent exact prices.

Do not repeatedly ask for the industry if the requirement itself already gives enough context.

Be natural like a real software sales executive, not like a form.

Keep the response short and conversational so it can be spoken by voice AI.`
              }
            ]
          }
        ],

        generationConfig: {
          maxOutputTokens: 300
        }
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
      reply: reply.trim()
    });

  } catch (error) {
    return res.status(500).json({
      error: "Server Error",
      message: error.message
    });
  }
}
