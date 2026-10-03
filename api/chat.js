export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is not configured in Vercel."
    });
  }

  try {
    const {
      message = "",
      history = [],
      memory = {}
    } = req.body || {};

    if (!message.trim()) {
      return res.status(400).json({ error: "Message is required." });
    }

    const systemPrompt = `
You are the AI Sales & Support Assistant for KIKT Software Solutions.

Your job is to understand customers naturally and help identify the software solution they need.

LANGUAGE:
- Understand Tamil, Tanglish and English.
- Reply naturally in the customer's language.
- For Tanglish, use simple spoken Tamil written in English.
- Sound like a real helpful sales/support person, NOT a questionnaire.
- You may use "sir" naturally, but don't overuse it.

IMPORTANT CONVERSATION RULES:

1. Understand meaning even when grammar is poor, words are misspelled,
   or speech-to-text has mistakes.

2. Infer the customer's industry and requirements from their message.
   Do NOT ask "what industry?" when it can already be inferred.

3. NEVER ask a question that the customer has already answered.

4. Ask only ONE useful next question at a time.

5. If the customer gives multiple requirements in one message,
   remember ALL of them.

6. If the customer corrects something, update the information.
   Do not continue with the old assumption.

7. If the customer says "I don't know", "you suggest", etc.,
   suggest suitable software modules based on their problem.

8. If the customer asks another question in the middle of the sales
   conversation, answer that question first and then continue naturally.

9. Never invent exact prices, delivery dates, guarantees or existing
   KIKT features that were not provided.

10. If the customer asks about price, explain that quotation depends
    on requirements and scope.

11. If the customer provides a phone number:
    - save it as contact
    - confirm it briefly
    - set leadClosed=true
    - NEVER ask for the phone number again.

12. If email is provided, remember it and don't ask again.

13. NEVER restart the conversation.

14. NEVER repeat a generic introduction after every message.

15. If customer says:
    "enaku meta ads la vara lead eduthu sales follow up
     panara mari app venu"

    Understand:
    - likely digital marketing / lead generation business
    - Meta Ads lead capture
    - lead management
    - sales follow-up

    Do NOT ask "what industry?" immediately.

16. If customer then says:
    "digital marketing"

    Do NOT repeat the previous answer.
    Continue with the next useful question.

17. If enough information is available, move toward quotation/contact
    instead of asking unnecessary questions.

18. Do not claim that a quotation, meeting or demo was actually booked
    unless the user has done it through this interface.

CURRENT MEMORY:
${JSON.stringify(memory, null, 2)}

CONVERSATION HISTORY:
${JSON.stringify(history.slice(-20), null, 2)}

LATEST CUSTOMER MESSAGE:
${message}

Return ONLY valid JSON:

{
  "reply": "complete natural reply to customer",
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

Memory rules:
- Preserve existing information.
- Add new requirements instead of deleting old ones.
- Update information when customer corrects it.
- Never put internal reasoning inside reply.
`;

    const contents = [];

    for (const item of history.slice(-20)) {
      if (!item || !item.role || !item.text) continue;

      contents.push({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: String(item.text) }]
      });
    }

    contents.push({
      role: "user",
      parts: [{
        text: `CURRENT MEMORY:
${JSON.stringify(memory)}

LATEST MESSAGE:
${message}`
      }]
    });

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      "gemini-2.5-flash:generateContent?key=" +
      encodeURIComponent(apiKey);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }]
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini error:", data);

      return res.status(502).json({
        error: data?.error?.message || "Gemini API request failed."
      });
    }

    const raw =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("") || "";

    if (!raw) {
      return res.status(502).json({
        error: "Gemini returned empty response."
      });
    }

    let result;

    try {
      result = JSON.parse(raw);
    } catch {
      const cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      result = JSON.parse(cleaned);
    }

    const oldMemory = memory || {};
    const newMemory = result.memory || {};

    const safeMemory = {
      industry:
        String(newMemory.industry || oldMemory.industry || ""),

      requirements:
        Array.isArray(newMemory.requirements)
          ? newMemory.requirements.map(String)
          : Array.isArray(oldMemory.requirements)
            ? oldMemory.requirements.map(String)
            : [],

      problems:
        Array.isArray(newMemory.problems)
          ? newMemory.problems.map(String)
          : Array.isArray(oldMemory.problems)
            ? oldMemory.problems.map(String)
            : [],

      users:
        String(newMemory.users || oldMemory.users || ""),

      platform:
        String(newMemory.platform || oldMemory.platform || ""),

      currentSystem:
        String(
          newMemory.currentSystem ||
          oldMemory.currentSystem ||
          ""
        ),

      contact:
        String(newMemory.contact || oldMemory.contact || ""),

      email:
        String(newMemory.email || oldMemory.email || ""),

      leadClosed:
        Boolean(
          newMemory.leadClosed ||
          oldMemory.leadClosed
        )
    };

    return res.status(200).json({
      reply: String(result.reply || ""),
      memory: safeMemory,
      nextQuestion: String(result.nextQuestion || ""),
      shouldClose: Boolean(
        result.shouldClose || safeMemory.leadClosed
      )
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: error?.message || "Unexpected server error."
    });
  }
}
