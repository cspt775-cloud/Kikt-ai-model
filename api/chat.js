export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is missing in Vercel."
    });
  }

  try {
    const body = req.body || {};

    const message = String(body.message || "").trim();
    const history = Array.isArray(body.history) ? body.history : [];
    const memory = body.memory || {};

    if (!message) {
      return res.status(400).json({
        error: "Customer message is empty."
      });
    }

    const prompt = `
You are KIKT Software Solutions AI Sales Assistant.

Understand Tamil, Tanglish and English naturally.

Customer message:
${message}

Previous conversation:
${JSON.stringify(history.slice(-15))}

Current memory:
${JSON.stringify(memory)}

Rules:
- Understand the customer's actual requirement.
- Do not repeat questions already answered.
- Ask only one useful next question.
- If customer says they need software to convert leads into sales,
  understand this as lead management / CRM / sales follow-up.
- Do not unnecessarily ask the industry first.
- Keep the response short and natural.
- Never invent exact pricing.

Return only JSON:

{
  "reply": "natural reply",
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
  },
  "nextQuestion": "",
  "shouldClose": false
}
`;

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
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "GEMINI ERROR:",
        JSON.stringify(data)
      );

      return res.status(500).json({
        error:
          "Gemini API Error: " +
          (
            data?.error?.message ||
            JSON.stringify(data)
          )
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return res.status(500).json({
        error:
          "Gemini returned no text. Response: " +
          JSON.stringify(data)
      });
    }

    let result;

    try {
      result = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({
        error:
          "Gemini JSON parsing failed. Raw response: " +
          text
      });
    }

    return res.status(200).json({
      reply: result.reply || "",
      memory: result.memory || memory,
      nextQuestion: result.nextQuestion || "",
      shouldClose: !!result.shouldClose
    });

  } catch (error) {

    console.error(
      "SERVER ERROR:",
      error
    );

    return res.status(500).json({
      error:
        "Server Error: " +
        (error?.message || String(error))
    });
  }
}
