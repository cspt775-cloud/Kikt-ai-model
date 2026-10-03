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

    const {
      message,
      history = [],
      memory = {}
    } = req.body || {};

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: "Message missing"
      });
    }

    /*
    ============================================================
    MEMORY
    ============================================================
    */

    const currentMemory = {
      industry: memory.industry || "",

      requirements: Array.isArray(memory.requirements)
        ? memory.requirements
        : [],

      problems: Array.isArray(memory.problems)
        ? memory.problems
        : [],

      users: memory.users || "",

      platform: memory.platform || "",

      currentSystem: memory.currentSystem || "",

      contact: memory.contact || "",

      email: memory.email || "",

      leadClosed: !!memory.leadClosed
    };

    /*
    ============================================================
    HISTORY
    ============================================================
    */

    const conversationHistory = Array.isArray(history)
      ? history
          .slice(-20)
          .map(item => {
            const role =
              item.role === "assistant"
                ? "AI"
                : "CUSTOMER";

            return `${role}: ${item.content || ""}`;
          })
          .join("\n")
      : "";

    /*
    ============================================================
    PROMPT
    ============================================================
    */

    const prompt = `
You are the AI Sales and Support Assistant for KIKT Software Solutions.

Have a natural conversation with the customer.

Customer can speak:
Tamil, Tanglish, English, mixed language, or speech-to-text with spelling mistakes.

Understand the meaning, not just exact words.

Reply in simple conversational Tanglish/Tamil unless the customer clearly prefers English.

The response will be spoken by voice, so keep it short and natural.

==================================================
IMPORTANT
==================================================

NEVER stop the conversation after only saying:

"Kandippa"
"Sure"
"Okay"
"Kandippa pannidalam"

After understanding the requirement, continue with ONE useful next question.

Example:

Customer:
"enaku vara leads ah manage pani sales ah matha software venu"

Good response:

"Kandippa sir. Leads mainly Meta Ads-la irundhu varudha, WhatsApp-la irundhu varudha, illa website-la irundhu varudha?"

==================================================
DO NOT REPEAT QUESTIONS
==================================================

Read the previous conversation and memory.

If customer already answered something, do NOT ask the same thing again.

Example:

Customer:
"meta ads la irundhu"

Next question should NOT be:
"Leads enga irundhu varudhu?"

Instead:

"Ippo andha Meta Ads leads-ah Excel-la manage panreengala illa vera edhavadhu use panreengala?"

==================================================
ONE QUESTION ONLY
==================================================

Ask only ONE useful question at a time.

Do not ask many questions together.

Choose the next question based on what the customer already said.

==================================================
UNDERSTAND REQUIREMENTS
==================================================

Example:

"enaku vara leads ah manage pani sales ah matha software venu"

Understand:

Lead Management
Sales Follow-up
Lead Conversion
CRM workflow

Do not ask:
"What software do you need?"

==================================================
MULTIPLE REQUIREMENTS
==================================================

If customer gives multiple requirements, remember all of them.

Do not make them repeat.

==================================================
CURRENT MEMORY
==================================================

${JSON.stringify(currentMemory)}

==================================================
PREVIOUS CONVERSATION
==================================================

${conversationHistory || "No previous conversation."}

==================================================
CURRENT CUSTOMER MESSAGE
==================================================

${message}

==================================================
RESPONSE
==================================================

Give ONE natural conversational reply.

Do not invent prices.

If customer asks price, explain that exact cost depends on requirements.

If customer gives phone/email, remember it and don't ask again.

If customer changes requirement or industry, adapt.

If customer says "I don't know" or "you suggest", suggest something useful instead of stopping.

IMPORTANT:
Your main priority is a natural continuing conversation.
`;

    /*
    ============================================================
    MODELS
    ============================================================
    */

    const models = [
      "gemini-3.8-flash",
      "gemini-3.5-flash-lite"
    ];

    /*
    ============================================================
    CALL GEMINI
    ============================================================
    */

    async function callGemini(model) {

      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      return await fetch(url, {
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
            maxOutputTokens: 300
          }
        })
      });
    }

    /*
    ============================================================
    RETRY
    ============================================================
    */

    let response = null;
    let data = null;
    let lastError = null;

    for (const model of models) {

      for (let attempt = 1; attempt <= 2; attempt++) {

        try {

          response = await callGemini(model);

          data = await response.json();

          if (response.ok) {
            break;
          }

          const retryable =
            response.status === 429 ||
            response.status === 500 ||
            response.status === 502 ||
            response.status === 503 ||
            response.status === 504;

          lastError = {
            model,
            attempt,
            status: response.status,
            data
          };

          if (!retryable) {
            break;
          }

          if (attempt < 2) {

            await new Promise(resolve =>
              setTimeout(resolve, 1000 * attempt)
            );

          }

        } catch (error) {

          lastError = {
            model,
            attempt,
            message: error.message
          };

          if (attempt < 2) {

            await new Promise(resolve =>
              setTimeout(resolve, 1000 * attempt)
            );

          }
        }
      }

      if (response && response.ok) {
        break;
      }
    }

    /*
    ============================================================
    ALL GEMINI REQUESTS FAILED
    ============================================================
    */

    if (!response || !response.ok) {

      return res.status(500).json({
        error: "Gemini temporarily unavailable",
        details: lastError
      });
    }

    /*
    ============================================================
    GET GEMINI TEXT
    ============================================================
    */

    let rawReply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawReply) {

      return res.status(500).json({
        error: "No Gemini reply",
        details: data
      });
    }

    rawReply = rawReply.trim();

    /*
    ============================================================
    TRY JSON
    ============================================================
    
    JSON is OPTIONAL now.

    If Gemini gives valid JSON:
       use memory + reply.

    If Gemini gives normal text:
       use that text directly.

    THIS PREVENTS THE CONVERSATION FROM STOPPING.
    ============================================================
    */

    let aiResult = null;

    try {

      aiResult = JSON.parse(rawReply);

    } catch (error) {

      /*
      ----------------------------------------------------------
      Try extracting JSON if Gemini wrapped it in markdown
      ----------------------------------------------------------
      */

      try {

        const firstBrace = rawReply.indexOf("{");
        const lastBrace = rawReply.lastIndexOf("}");

        if (
          firstBrace !== -1 &&
          lastBrace !== -1 &&
          lastBrace > firstBrace
        ) {

          const possibleJson =
            rawReply.substring(
              firstBrace,
              lastBrace + 1
            );

          aiResult = JSON.parse(possibleJson);
        }

      } catch (ignore) {

        aiResult = null;
      }
    }

    /*
    ============================================================
    CASE 1
    VALID JSON RESPONSE
    ============================================================
    */

    if (aiResult && typeof aiResult === "object") {

      const aiMemory = aiResult.memory || {};

      const newMemory = {

        industry:
          aiMemory.industry ||
          currentMemory.industry ||
          "",

        requirements:
          Array.isArray(aiMemory.requirements)
            ? aiMemory.requirements
            : currentMemory.requirements,

        problems:
          Array.isArray(aiMemory.problems)
            ? aiMemory.problems
            : currentMemory.problems,

        users:
          aiMemory.users ||
          currentMemory.users ||
          "",

        platform:
          aiMemory.platform ||
          currentMemory.platform ||
          "",

        currentSystem:
          aiMemory.currentSystem ||
          currentMemory.currentSystem ||
          "",

        contact:
          aiMemory.contact ||
          currentMemory.contact ||
          "",

        email:
          aiMemory.email ||
          currentMemory.email ||
          "",

        leadClosed:
          typeof aiMemory.leadClosed === "boolean"
            ? aiMemory.leadClosed
            : currentMemory.leadClosed
      };

      const finalReply =
        typeof aiResult.reply === "string"
          ? aiResult.reply.trim()
          : "";

      if (finalReply) {

        return res.status(200).json({

          reply: finalReply,

          memory: newMemory,

          leadClosed:
            typeof aiResult.leadClosed === "boolean"
              ? aiResult.leadClosed
              : newMemory.leadClosed
        });
      }
    }

    /*
    ============================================================
    CASE 2
    GEMINI RETURNED NORMAL TEXT
    ============================================================

    IMPORTANT:
    DO NOT THROW ERROR.

    Just use Gemini's text as the reply.
    Conversation continues.
    ============================================================
    */

    return res.status(200).json({

      reply: rawReply,

      memory: currentMemory,

      leadClosed: currentMemory.leadClosed

    });

  } catch (error) {

    return res.status(500).json({
      error: "Server Error",
      message: error.message
    });
  }
}
