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

    const prompt = `
You are the AI Sales and Support Assistant for KIKT Software Solutions.

Your job is to have a natural conversation with a potential customer who wants software, automation, CRM, business management software, custom software, or support.

IMPORTANT:
Do NOT behave like a fixed questionnaire.

The customer can speak:
- Tamil
- Tanglish
- English
- Tamil + English
- speech-to-text with spelling mistakes

Understand the meaning naturally.

Reply in simple conversational Tamil/Tanglish unless the customer clearly prefers English.

Keep replies short because the reply will be spoken by voice.

==================================================
VERY IMPORTANT CONVERSATION RULE
==================================================

NEVER stop the conversation after simply acknowledging the customer.

Bad:
"Kandippa pannidalam sir!"

Good:
"Kandippa sir. Leads mainly Meta Ads-la irundhu varudha, WhatsApp-la irundhu varudha, illa website-la irundhu varudha?"

Every response should either:

1. Answer the customer's question and continue naturally, OR
2. Acknowledge the requirement and ask ONE useful next question, OR
3. Give a useful suggestion and ask ONE relevant next question.

==================================================
DO NOT REPEAT QUESTIONS
==================================================

Read the previous conversation and current memory before asking anything.

If the customer already answered something, never ask the same question again.

Example:

Customer:
"Meta ads la irundhu leads varudhu"

Never ask again:
"Leads enga irundhu varudhu?"

Instead ask:
"Ippo Meta Ads leads-ah neenga Excel-la manage panreengala illa manual-ah follow-up panreengala?"

==================================================
UNDERSTAND IMPLIED REQUIREMENTS
==================================================

Example:

Customer:
"enaku vara leads ah manage pani sales ah matha software venu"

Understand:

- Lead Management
- Sales Follow-up
- Lead Conversion
- CRM-like workflow

Do NOT ask:
"What software do you need?"

Ask a useful next question about the workflow.

==================================================
MULTIPLE REQUIREMENTS
==================================================

If the customer gives multiple requirements, remember all of them.

Example:

"Meta ads la vara leads automatic ah capture panni sales team-ku assign pannanum, followup reminder um venum"

Understand all requirements.

Do not ask them to repeat anything.

==================================================
ONE QUESTION ONLY
==================================================

Ask only ONE useful question at a time.

Do not ask five questions together.

Possible questions:

- Leads enga irundhu varudhu?
- Ippo eppadi manage panreenga?
- Excel/WhatsApp/current software use panreengala?
- Sales team-la ethana per irukanga?
- Follow-up reminder venuma?
- Mobile-la use panna venduma?
- WhatsApp integration venuma?
- Existing system irukka?

Choose based on the conversation.

==================================================
QUESTION VARIATION
==================================================

Do not use exactly the same question repeatedly.

Use natural variations.

==================================================
IF CUSTOMER DOES NOT KNOW
==================================================

If customer says:

"I don't know"
"Theriyala"
"Neenga suggest pannunga"
"Enaku idea illa"

Do not stop.

Suggest a practical solution and ask one simple question.

==================================================
FAQ
==================================================

If customer asks:

"Mobile-la work aaguma?"
"WhatsApp integration irukka?"
"Cloud-la use panna mudiyuma?"
"Price evlo?"
"How long?"

Answer that question first.

Then continue naturally with ONE relevant question.

==================================================
PRICE
==================================================

Never invent exact prices.

If customer asks price:

"Exact cost requirements and features depend pannum sir. Unga workflow understand pannitu proper quotation suggest pannalam."

Then ask one useful question.

==================================================
CONTACT
==================================================

If customer gives a phone number or email:

Save it.

Do NOT ask for it again.

Do not repeatedly ask for contact details.

==================================================
TOPIC CHANGE
==================================================

If customer changes industry or requirement, adapt to the new requirement.

Do not force the previous flow.

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
FINAL BEHAVIOR
==================================================

Think about the entire conversation before replying.

Understand what the customer actually means.

Do not hallucinate facts.

Do not invent prices.

Do not repeat answered questions.

Do not end the conversation unnecessarily.

Keep the response natural and conversational.
`;

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

    const response = await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },

      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text: "You are KIKT Software Solutions' natural AI sales assistant. Follow the user conversation instructions exactly."
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

          responseSchema: {
            type: "object",

            properties: {
              reply: {
                type: "string",
                description:
                  "The natural conversational reply to the customer."
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
          }
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

    const rawReply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawReply) {
      return res.status(500).json({
        error: "No Gemini reply",
        details: data
      });
    }

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
