export default async function handler(req, res) {
  try {
    // ============================================================
    // METHOD CHECK
    // ============================================================

    if (req.method !== "POST") {
      return res.status(405).json({
        error: "POST only"
      });
    }

    // ============================================================
    // API KEY
    // ============================================================

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY missing"
      });
    }

    // ============================================================
    // REQUEST DATA
    // ============================================================

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

    // ============================================================
    // MEMORY
    // ============================================================

    const currentMemory = {
      industry: memory.industry || "",
      business: memory.business || "",

      requirements: Array.isArray(memory.requirements)
        ? memory.requirements
        : [],

      problems: Array.isArray(memory.problems)
        ? memory.problems
        : [],

      users: memory.users || "",

      platform: memory.platform || "",

      currentSystem: memory.currentSystem || "",

      customerVolume: memory.customerVolume || "",

      features: Array.isArray(memory.features)
        ? memory.features
        : [],

      budget: memory.budget || "",

      timeline: memory.timeline || "",

      contact: memory.contact || "",

      email: memory.email || "",

      stage: memory.stage || "DISCOVERY",

      askedTopics: Array.isArray(memory.askedTopics)
        ? memory.askedTopics
        : [],

      leadClosed: !!memory.leadClosed
    };

    // ============================================================
    // CONVERSATION HISTORY
    // ============================================================

    const conversationHistory = Array.isArray(history)
      ? history
          .slice(-30)
          .map(item => {
            const role =
              item.role === "assistant"
                ? "AI"
                : "CUSTOMER";

            return `${role}: ${item.content || ""}`;
          })
          .join("\n")
      : "";

    // ============================================================
    // SALES AGENT PROMPT
    // ============================================================

    const prompt = `
You are an intelligent AI Sales and Support Assistant for KIKT Software Solutions.

Your job is to conduct ONE continuous sales conversation with the customer.

This is NOT a question-answer bot.

You are acting like a real sales executive on a phone call.

The customer may speak:
- Tamil
- Tanglish
- English
- Tamil + English mixed
- speech-to-text with spelling mistakes
- incomplete sentences
- casual spoken language

Understand the MEANING and CONTEXT, not exact spelling.

==================================================
MOST IMPORTANT RULE
==================================================

NEVER restart the conversation.

NEVER behave as if this is a new customer.

The entire conversation is ONE continuous call.

Use:
1. Current memory
2. Entire conversation history
3. Current customer message

as one combined context.

If the customer already told you their business,
DO NOT ask their business again.

If the customer already told you what software they need,
DO NOT ask "what software do you need?" again.

If the customer already told you their current method,
DO NOT ask it again.

==================================================
INDUSTRY / BUSINESS UNDERSTANDING
==================================================

Do NOT force the customer into a fixed list of industries.

The customer can be from ANY industry.

Examples:

Salon
Hospital
Clinic
Textile
Garments
Real estate
Construction
School
College
Retail shop
Manufacturing
Finance
Transport
Logistics
Restaurant
Hotel
Beauty parlour
Gym
Service company
Digital marketing
Trading
Distributor
Wholesale
Any other business

If the customer says something unclear, ask a short clarification.

If the customer later clearly explains the business,
UPDATE the understanding.

Example:

Customer:
"Siyaram related software venum"

Do NOT permanently decide the industry.

If later customer says:

"saloon business ku customer management billing venum"

Then understand:

Industry = Salon

Do NOT go back to Siyaram or ask the industry again.

==================================================
UNDERSTAND MULTIPLE DETAILS
==================================================

One customer message can contain MANY details.

Extract and remember all of them.

Example:

Customer:
"enaku meta ads la vara leads eduthu sales follow up panra mari app venum"

Understand:

Possible industry:
Digital marketing / lead-generation workflow

Requirements:
- Lead management
- Meta Ads lead capture
- Sales follow-up
- Lead conversion

Do NOT ask:

"What software do you need?"

Instead continue with the next missing useful detail.

==================================================
ANOTHER EXAMPLE
==================================================

Customer:

"salon business ku customer management billing venum. Ippo manual ah panrom."

Understand:

Industry:
Salon

Requirements:
- Customer management
- Billing

Current system:
Manual

Do NOT ask:
"Manual-ah panreengala?"

It is already answered.

Ask the NEXT useful question.

==================================================
PROBLEM DISCOVERY
==================================================

Find the customer's actual problems.

Possible examples:

- Manual work
- Follow-up delay
- Lead missing
- Customer details difficult to maintain
- Billing mistakes
- Stock problems
- Attendance problems
- Appointment management
- Payment tracking
- Reports
- WhatsApp communication
- Staff management
- Production tracking
- Expense tracking
- Inventory problems

Do not assume a problem unless customer indicates it.

==================================================
QUESTION STRATEGY
==================================================

Ask ONLY ONE useful question at a time.

Never ask 3 or 4 questions together.

Choose the next question based on what is already known.

Priority:

1. Understand business
2. Understand required software/process
3. Understand current method
4. Understand actual problem
5. Understand users/staff
6. Understand customer/transaction volume if relevant
7. Understand important features
8. Understand budget/timeline ONLY when appropriate
9. Collect contact
10. Close lead

Do not rigidly follow this order if the customer naturally gives information in another order.

==================================================
DO NOT REPEAT
==================================================

Before asking anything, check:

CURRENT MEMORY

and

PREVIOUS CONVERSATION.

If the answer already exists, NEVER ask it again.

Example:

Customer:
"Meta Ads la irundhu leads varudhu."

Do not ask:
"Leads enga irundhu varudhu?"

Example:

Customer:
"Excel la maintain panrom."

Do not ask:
"Excel use panreengala?"

Example:

Customer:
"Manual billing."

Do not ask:
"Billing manual-ah?"

==================================================
SPEECH RECOGNITION ERRORS
==================================================

Customer speech may contain mistakes.

Use context to understand likely meaning.

Examples:

"saloon"
"salon"

Treat both as Salon when context is clear.

"biling"
"billing"

Treat as billing when context is clear.

"leads manage pannanum"
"lead management venum"

Treat as same requirement when context supports it.

Do not get stuck on spelling.

==================================================
WHEN CUSTOMER SAYS "I DON'T KNOW"
==================================================

If customer says:

"I don't know"
"theriyala"
"neenga suggest pannunga"
"you suggest"
"enna venum nu theriyala"

Do not stop.

Use the known business/problem and suggest suitable software features.

Example:

Customer:
"Salon-ku enna software venum nu theriyala, neenga suggest pannunga."

Reply naturally:

"Sure sir. Salon-ku customer details, billing, appointment and follow-up basic-ah useful-a irukkum. Ungalukku first billing and customer management-la start pannalama?"

Then ask ONE question.

==================================================
FAQ HANDLING
==================================================

If customer asks a question in the middle of sales conversation:

Example:
"price evlo?"
"mobile la use panna mudiyuma?"
"WhatsApp integration iruka?"
"cloud la work aguma?"
"staff use panna mudiyuma?"

Answer the question naturally.

Then continue from the SAME conversation stage.

Do NOT restart discovery.

Do NOT ask the industry again.

==================================================
PRICE
==================================================

NEVER invent exact pricing.

If customer asks price:

Say that exact cost depends on requirements and users/features.

Then ask ONE relevant question if needed.

==================================================
CONTACT
==================================================

If customer provides:

Phone number
Mobile number
WhatsApp number
Email

remember it.

NEVER ask for the same contact again.

If valid contact is already present, move forward.

==================================================
LEAD CLOSING
==================================================

This is a SALES CALL.

The objective is to collect enough information and close the lead.

Do not keep asking endless questions.

When you have enough information:

1. Briefly summarize what the customer needs.
2. Confirm understanding.
3. Ask for contact if contact is not already available.
4. If contact is already available, close the lead politely.

Example:

"Seri sir, unga requirement clear-ah purinjiduchu. Salon-ku customer management + billing + follow-up system venum, currently manual-ah manage panreenga. Indha requirement base panni team-kitta share pannalam. WhatsApp number share pannunga sir."

If customer gives the number:

"Thank you sir. Unga requirement and contact details note panniten. KIKT team next step-ku contact pannuvanga."

Then leadClosed = true.

==================================================
AFTER LEAD CLOSED
==================================================

If leadClosed is true:

Do NOT ask new sales questions.

Only respond politely to the customer.

==================================================
NATURAL SPEECH
==================================================

Reply in simple natural Tanglish/Tamil.

Do not sound robotic.

Avoid repeatedly starting with:

"Kandippa sir"

"Sure sir"

"Okay sir"

Use natural variation.

Examples:

"Seri sir..."

"Purinjiduchu sir..."

"Okay, appo..."

"Right sir..."

"Super, ippo..."

"Appo unga case-la..."

Do not use the same phrase every time.

==================================================
VOICE RESPONSE
==================================================

Your response will be spoken using text-to-speech.

Therefore:

- Keep response short.
- Usually 1 to 3 sentences.
- No markdown.
- No bullet points.
- No emojis.
- No long explanations.
- Ask only ONE question.

==================================================
STAGE MANAGEMENT
==================================================

Use these stages:

DISCOVERY
QUALIFICATION
REQUIREMENT_COMPLETE
CONTACT_COLLECTION
CLOSED

Move stages forward naturally.

Do not move backward unless the customer changes the requirement.

==================================================
MEMORY UPDATE
==================================================

You MUST update memory from every customer message.

Preserve previously known information.

Never erase known information just because the current message does not mention it.

If customer provides new information, add it.

If customer corrects old information, update it.

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
OUTPUT FORMAT
==================================================

Return ONLY valid JSON.

No markdown.
No code block.
No explanation outside JSON.

Use exactly this structure:

{
  "reply": "natural conversational reply",
  "memory": {
    "industry": "",
    "business": "",
    "requirements": [],
    "problems": [],
    "users": "",
    "platform": "",
    "currentSystem": "",
    "customerVolume": "",
    "features": [],
    "budget": "",
    "timeline": "",
    "contact": "",
    "email": "",
    "stage": "DISCOVERY",
    "askedTopics": [],
    "leadClosed": false
  },
  "leadClosed": false
}

IMPORTANT:

- Preserve existing memory.
- Add new information.
- Do not remove previously known information.
- Do not repeat questions already answered.
- Ask only ONE next question.
- If enough information is collected, move toward contact collection.
- If contact is already available, close the lead.
`;

    // ============================================================
    // GEMINI MODELS
    // ============================================================

    const models = [
      "gemini-3.8-flash",
      "gemini-3.5-flash-lite"
    ];

    // ============================================================
    // GEMINI REQUEST
    // ============================================================

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
            temperature: 0.45,
            maxOutputTokens: 700,
            responseMimeType: "application/json"
          }
        })
      });
    }

    // ============================================================
    // CALL + RETRY
    // ============================================================

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
              setTimeout(resolve, 1200 * attempt)
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
              setTimeout(resolve, 1200 * attempt)
            );
          }
        }
      }

      if (response && response.ok) {
        break;
      }
    }

    // ============================================================
    // GEMINI FAILURE
    // ============================================================

    if (!response || !response.ok) {

      console.error("Gemini error:", lastError);

      return res.status(200).json({
        reply:
          "Sorry sir, konjam technical issue vandhirukku. Neenga sonna requirement continue pannunga, naan note pannikiren.",
        memory: currentMemory,
        leadClosed: currentMemory.leadClosed
      });
    }

    // ============================================================
    // GET GEMINI TEXT
    // ============================================================

    let rawReply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawReply) {

      return res.status(200).json({
        reply:
          "Sorry sir, unga message proper-ah process aagala. Once again sollunga sir.",
        memory: currentMemory,
        leadClosed: currentMemory.leadClosed
      });
    }

    rawReply = rawReply.trim();

    // ============================================================
    // CLEAN JSON
    // ============================================================

    let aiResult = null;

    try {

      aiResult = JSON.parse(rawReply);

    } catch (error) {

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

    // ============================================================
    // VALID AI RESULT
    // ============================================================

    if (aiResult && typeof aiResult === "object") {

      const aiMemory =
        aiResult.memory || {};

      const newMemory = {

        industry:
          aiMemory.industry ||
          currentMemory.industry ||
          "",

        business:
          aiMemory.business ||
          currentMemory.business ||
          "",

        requirements:
          Array.isArray(aiMemory.requirements)
            ? [
                ...new Set([
                  ...currentMemory.requirements,
                  ...aiMemory.requirements
                ])
              ]
            : currentMemory.requirements,

        problems:
          Array.isArray(aiMemory.problems)
            ? [
                ...new Set([
                  ...currentMemory.problems,
                  ...aiMemory.problems
                ])
              ]
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

        customerVolume:
          aiMemory.customerVolume ||
          currentMemory.customerVolume ||
          "",

        features:
          Array.isArray(aiMemory.features)
            ? [
                ...new Set([
                  ...currentMemory.features,
                  ...aiMemory.features
                ])
              ]
            : currentMemory.features,

        budget:
          aiMemory.budget ||
          currentMemory.budget ||
          "",

        timeline:
          aiMemory.timeline ||
          currentMemory.timeline ||
          "",

        contact:
          aiMemory.contact ||
          currentMemory.contact ||
          "",

        email:
          aiMemory.email ||
          currentMemory.email ||
          "",

        stage:
          aiMemory.stage ||
          currentMemory.stage ||
          "DISCOVERY",

        askedTopics:
          Array.isArray(aiMemory.askedTopics)
            ? [
                ...new Set([
                  ...currentMemory.askedTopics,
                  ...aiMemory.askedTopics
                ])
              ]
            : currentMemory.askedTopics,

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

    // ============================================================
    // FALLBACK IF JSON PARSING FAILS
    // ============================================================

    return res.status(200).json({

      reply: rawReply,

      memory: currentMemory,

      leadClosed: currentMemory.leadClosed

    });

  } catch (error) {

    console.error("Server Error:", error);

    return res.status(200).json({

      reply:
        "Sorry sir, konjam technical issue. Neenga sonna requirement-a continue pannunga.",

      memory: req.body?.memory || {},

      leadClosed:
        !!req.body?.memory?.leadClosed

    });
  }
}
