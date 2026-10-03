export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is missing in Vercel Environment Variables"
    });
  }

  try {
    const body = req.body || {};
    const message = body.message || "";

    if (!message.trim()) {
      return res.status(400).json({
        error: "Message is empty"
      });
    }

    const prompt = `
You are an AI sales assistant for KIKT Software Solutions.

Customer message:
${message}

Understand the customer's requirement naturally.

Return ONLY valid JSON in this format:

{
  "reply": "natural Tamil/Tanglish reply",
  "memory": {
    "industry": "",
    "requirements": [],
    "problems": [],
    "users": "",
    "platform": "",
    "currentSystem": "",
    "contact": "",
    "email": "",
    "leadClosed": false
  }
}

Do not invent pricing.
If the customer says they need software to manage incoming leads and convert them into sales, understand that as a lead management / sales follow-up requirement.
Ask the next useful question naturally.
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json"
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: "Gemini API Error",
        status: response.status,
        details: data
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return res.status(500).json({
        error: "Gemini returned no text",
        details: data
      });
    }

    let result;

    try {
      result = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({
        error: "Gemini returned invalid JSON",
        raw: text
      });
    }

    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      message: error.message
    });
  }
}
