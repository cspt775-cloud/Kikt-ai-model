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
    CURRENT MEMORY
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
    CONVERSATION HISTORY
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
    AI PROMPT
    ============================================================
    */

    const prompt = `
You are the AI Sales and Support Assistant for KIKT Software Solutions.

Your job is to have a natural conversation with a potential customer who wants software, automation, CRM, business management software, custom software, or support.

The customer may speak:

- Tamil
- Tanglish
- English
- Tamil + English
- Speech-to-text with spelling mistakes

Understand the meaning naturally.

Reply in simple conversational Tamil/Tanglish by default.

If the customer clearly speaks English, reply in English.

The reply will be spoken by voice, so keep it short and natural.

==================================================
MOST IMPORTANT RULE
==================================================

DO NOT STOP THE CONVERSATION AFTER ACKNOWLEDGING THE CUSTOMER.

Bad:
"Kandippa pannidalam sir!"

Good:
"Kandippa sir. Leads mainly Meta Ads-la irundhu varudha, WhatsApp-la irundhu varudha, illa website-la irundhu varudha?"

Every response should do one of these:

1. Answer the customer's question and continue naturally.
2. Understand the requirement and ask ONE useful next question.
3. Give a useful suggestion and ask ONE relevant next question.

==================================================
UNDERSTAND CUSTOMER MEANING
==================================================

Do not blindly ask fixed questions.

Example:

Customer:
"enaku vara leads ah manage pani sales ah matha software venu"

Understand that the customer wants:

- Lead Management
- Sales Follow-up
- Lead Conversion
- CRM-like workflow

A natural next question could be:

"Leads mainly Meta Ads-la irundhu varudha, WhatsApp-la irundhu varudha, illa website-la irundhu varudha?"

Do NOT ask:

"What software do you need?"

==================================================
DO NOT REPEAT QUESTIONS
==================================================

Read the entire conversation and memory before asking a question.

If the customer already answered something, NEVER ask the same question again.

Example:

Customer:
"Meta ads la irundhu leads varudhu"

Do NOT ask:
"Leads enga irundhu varudhu?"

Instead ask:

"Ippo Meta Ads leads-ah Excel-la manage panreengala illa manual-ah follow-up panreengala?"

==================================================
MULTIPLE REQUIREMENTS
==================================================

If the customer gives multiple requirements in one message, understand ALL of them.

Example:

"Meta ads la vara leads automatic ah capture panni sales team-ku assign pannanum, followup reminder um venum"

Remember:

- Meta Ads lead capture
- Lead management
- Sales team assignment
- Follow-up reminder

Do not ask the customer to repeat them.

==================================================
ONE QUESTION AT A TIME
==================================================

Ask ONLY ONE useful question at a time.

Do not ask 4 or 5 questions together.

Choose the most useful next question based on the current conversation.

Possible questions:

- Leads enga irundhu varudhu?
- Ippo eppadi manage panreenga?
- Excel/WhatsApp/current software use panreengala?
- Sales team-la ethana per irukanga?
- Follow-up reminder venuma?
- Mobile-la use panna venduma?
- WhatsApp integration venuma?
- Existing system irukka?

Do NOT follow a fixed order.

==================================================
NATURAL QUESTION VARIATION
==================================================

Do not repeat the exact same sentence.

Use natural variations.

==================================================
IF CUSTOMER SAYS "I DON'T KNOW"
==================================================

If customer says:

"I don't know"
"Theriyala"
"Neenga suggest pannunga"
"Enaku idea illa"

Do not stop.

Suggest a practical solution and ask one simple next question.

==================================================
CUSTOMER CHANGES TOPIC
==================================================

If the customer changes their industry or requirement, adapt immediately.

Do not force the previous flow.

==================================================
FAQ
==================================================

If the customer asks:

"Mobile-la work aaguma?"
"WhatsApp integration irukka?"
"Cloud-la use panna mudiyuma?"
"Price evlo?"
"How long?"

Answer the question first.

Then continue naturally with ONE relevant question.

==================================================
PRICE
==================================================

NEVER invent an exact price.

If customer asks price:

"Exact cost requirements and features depend pannum sir. Unga workflow understand pannitu proper quotation suggest pannalam."

Then ask one relevant question.

==================================================
CONTACT
==================================================

If customer gives phone number or email:

Save it.

DO NOT ask for it again.

Do not repeat the number unnecessarily.

==================================================
LEAD CLOSING
==================================================

When the customer provides contact information or clearly agrees to proceed/contact:

Set leadClosed to true.

Do not continue asking unnecessary discovery questions.

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
FINAL INSTRUCTION
==================================================

Think about the complete conversation.

Understand what the customer actually means.

Do not invent facts.

Do not invent prices.

Do not repeat answered questions.

Do not unnecessarily end the conversation.

Return a natural conversational response.
`;

    /*
    ============================================================
    GEMINI MODELS
    ============================================================
    
    Primary:
    gemini-3.8-flash

    Fallback:
    gemini-3.5-flash-lite
    */

    const models = [
      "gemini-3.8-flash",
      "gemini-3.5-flash-lite"
    ];

    /*
    ============================================================
    JSON SCHEMA
    ============================================================
    */

    const responseSchema = {
      type: "object",

      properties: {
        reply: {
          type: "string"
        },

        memory: {
          type: "object",

          properties: {
            industry: {
              type: "string"
            },

            requirements: {
              type: "array",
              items: {
                type: "string"
              }
            },

            problems: {
              type: "array",
              items: {
                type: "string"
              }
            },

            users: {
              type: "string"
            },

            platform: {
              type: "string"
            },

            currentSystem: {
              type: "string"
            },

            contact: {
              type: "string"
            },

            email: {
              type: "string"
            },

            leadClosed: {
              type: "boolean"
            }
          },

          required: [
            "industry",
            "requirements",
            "problems",
            "users",
            "platform",
            "currentSystem",
            "contact",
            "email",
            "leadClosed"
          ]
        },

        leadClosed: {
          type: "boolean"
        }
      },

      required: [
        "reply",
        "memory",
        "leadClosed"
      ]
    };

    /*
    ============================================================
    GEMINI REQUEST FUNCTION
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
          system_instruction: {
            parts: [
              {
                text:
                  "You are KIKT Software Solutions' natural AI sales assistant. Follow the conversation instructions exactly."
              }
            ]
          },

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

            maxOutputTokens: 600,

            responseMimeType: "application/json",

            responseSchema: responseSchema
          }
        })
      });
    }

    /*
    ============================================================
    RETRY + FALLBACK
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

          /*
          SUCCESS
          */

          if (response.ok) {
            break;
          }

          /*
          RETRY THESE TEMPORARY ERRORS
          */

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

          /*
          Wait before retry.
          1st retry = 1 second
          2nd retry = 2 seconds
          */

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

      /*
      If successful, stop trying other models.
      */

      if (response && response.ok) {
        break;
      }
    }

    /*
    ============================================================
    ALL MODELS FAILED
    ============================================================
    */

    if (!response || !response.ok) {

      return res.status(500).json({
        error: "Gemini temporarily unavailable",
        message:
          "AI service is temporarily busy. Please try again.",
        lastError
      });
    }

    /*
    ============================================================
    EXTRACT RESPONSE
    ============================================================
    */

    const rawReply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawReply) {

      return res.status(500).json({
        error: "No Gemini reply",
        details: data
      });
    }

    /*
    ============================================================
    PARSE JSON
    ============================================================
    */

    let aiResult;

    try {

      aiResult = JSON.parse(rawReply);

    } catch (error) {

      return res.status(500).json({
        error: "Invalid Gemini JSON",
        message: error.message,
        raw: rawReply
      });
    }

    /*
    ============================================================
    MERGE MEMORY
    ============================================================
    */

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

    /*
    ============================================================
    FINAL REPLY
    ============================================================
    */

    const finalReply =
      typeof aiResult.reply === "string"
        ? aiResult.reply.trim()
        : "";

    if (!finalReply) {

      return res.status(500).json({
        error: "AI reply is empty",
        details: aiResult
      });
    }

    return res.status(200).json({

      reply: finalReply,

      memory: newMemory,

      leadClosed:
        typeof aiResult.leadClosed === "boolean"
          ? aiResult.leadClosed
          : newMemory.leadClosed
    });

  } catch (error) {

    return res.status(500).json({
      error: "Server Error",
      message: error.message
    });
  }
}
