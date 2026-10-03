export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY missing in Vercel Environment Variables."
    });
  }

  try {
    const body = req.body || {};

    const message = String(body.message || "").trim();

    const history = Array.isArray(body.history)
      ? body.history
      : [];

    const memory =
      body.memory &&
      typeof body.memory === "object"
        ? body.memory
        : {};

    if (!message) {
      return res.status(400).json({
        error: "Customer message is empty."
      });
    }

    const systemPrompt = `
You are the AI Sales & Support Assistant for KIKT Software Solutions.

You talk to customers about software requirements.

IMPORTANT:
You are NOT a rule-based chatbot.
You must understand the meaning of what the customer says.

LANGUAGES:
- Tamil
- Tanglish
- English
- Mixed Tamil + English
- Speech-to-text mistakes

Always understand the customer's intended meaning.

CONVERSATION STYLE:
- Natural
- Friendly
- Short
- Professional
- Human-like
- Do not sound like a questionnaire.
- You can call the customer "sir" naturally.
- Do not use "sir" in every sentence.

IMPORTANT SALES RULES:

1. Understand the customer's requirement from their message.

2. If the customer says:

"enaku vara leads ah follow panara mari software venu"

Understand that they need a Lead Management / CRM type software.

DO NOT immediately ask:
"Which industry?"

Instead respond naturally, for example:
"Sure sir. Unga leads-ah collect panni, follow-up status, reminder, salesperson assignment madhiri manage panna CRM solution customize pannalaam. Leads enga irundhu varudhu sir — Meta Ads, website, WhatsApp, illa vera source-ah?"

3. If the customer already mentioned their industry,
NEVER ask the industry again.

4. If the customer gives multiple requirements,
remember ALL requirements.

Example:

"Meta ads la vara lead eduthu sales follow up panara mari app venu"

Understand:

Industry:
Possibly Digital Marketing / Lead Generation

Requirements:
- Meta Ads lead capture
- Lead management
- Sales follow-up

Do NOT ask the same things again.

5. If the customer later says:

"digital marketing"

Then remember:

Industry = Digital Marketing

Continue the conversation.

Do NOT repeat the previous answer.

6. If the customer says:
"I don't know"
"you suggest"
"neenga suggest pannunga"

Then suggest suitable software modules based on the problem.

7. If customer asks a question in the middle,
answer that question first and continue the conversation.

8. Never repeat a question that has already been answered.

9. Never restart the conversation.

10. Never give fake exact pricing.

If asked price:
"Quotation depends on the required modules and scope sir."

11. If customer provides phone number:
- Save the number.
- Confirm it.
- Set leadClosed = true.
- Do NOT ask phone number again.

12. If customer provides email:
save it and don't ask again.

13. If customer changes their requirement:
update memory.

14. If customer corrects a speech recognition mistake:
understand the correction and continue.

15. Ask only ONE useful question at a time.

16. If enough information is available,
move naturally toward contact/demo/quotation.

17. Never claim a meeting or quotation was actually booked unless it was done through this application.

18. Do not invent KIKT features.
If uncertain, say:
"We can customize/develop that based on your requirement."

CURRENT MEMORY:
${JSON.stringify(memory, null, 2)}

PREVIOUS CONVERSATION:
${JSON.stringify(history.slice(-20), null, 2)}

LATEST CUSTOMER MESSAGE:
${message}

Return ONLY valid JSON.

Required format:

{
  "reply": "natural reply to customer",
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

MEMORY RULES:
- Keep existing information.
- Add new requirements.
- Do not delete old requirements unless customer clearly changes them.
- Update industry when customer provides it.
- Never ask already answered questions.
`;

    const contents = [];

    for (const item of history.slice(-20)) {
      if (!item) continue;

      if (!item.role || !item.text) continue;

      contents.push({
        role:
          item.role === "assistant"
            ? "model"
            : "user",

        parts: [
          {
            text: String(item.text)
          }
        ]
      });
    }

    contents.push({
      role: "user",

      parts: [
        {
          text: `
CURRENT CUSTOMER MEMORY:

${JSON.stringify(memory, null, 2)}

LATEST CUSTOMER MESSAGE:

${message}
`
        }
      ]
    });

    /*
      Gemini REST API
    */

    const geminiURL =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    const geminiResponse = await fetch(
      geminiURL,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },

        body: JSON.stringify({

          system_instruction: {
            parts: [
              {
                text: systemPrompt
              }
            ]
          },

          contents: contents,

          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json"
          }

        })
      }
    );

    const data =
      await geminiResponse.json();

    /*
      Gemini API error
    */

    if (!geminiResponse.ok) {

      console.error(
        "GEMINI API ERROR:",
        JSON.stringify(data)
      );

      return res.status(502).json({

        error:
          data?.error?.message ||
          "Gemini API request failed."

      });
    }

    /*
      Extract Gemini response
    */

    const parts =
      data?.candidates?.[0]?.content?.parts || [];

    const rawResponse =
      parts
        .map(part => part.text || "")
        .join("")
        .trim();

    if (!rawResponse) {

      console.error(
        "EMPTY GEMINI RESPONSE:",
        JSON.stringify(data)
      );

      return res.status(502).json({
        error:
          "Gemini returned an empty response."
      });
    }

    /*
      Parse JSON
    */

    let result;

    try {

      result =
        JSON.parse(rawResponse);

    } catch (error) {

      const cleaned =
        rawResponse
          .replace(/^```json/i, "")
          .replace(/^```/i, "")
          .replace(/```$/i, "")
          .trim();

      try {

        result =
          JSON.parse(cleaned);

      } catch (jsonError) {

        console.error(
          "INVALID GEMINI JSON:",
          rawResponse
        );

        return res.status(502).json({
          error:
            "Gemini returned invalid JSON."
        });
      }
    }

    /*
      Previous memory
    */

    const oldMemory = memory || {};

    const aiMemory =
      result.memory || {};

    /*
      Build safe memory
    */

    const safeMemory = {

      industry:
        String(
          aiMemory.industry ||
          oldMemory.industry ||
          ""
        ),

      requirements:
        Array.isArray(
          aiMemory.requirements
        )
          ? aiMemory.requirements.map(
              String
            )
          : Array.isArray(
              oldMemory.requirements
            )
              ? oldMemory.requirements.map(
                  String
                )
              : [],

      problems:
        Array.isArray(
          aiMemory.problems
        )
          ? aiMemory.problems.map(
              String
            )
          : Array.isArray(
              oldMemory.problems
            )
              ? oldMemory.problems.map(
                  String
                )
              : [],

      users:
        String(
          aiMemory.users ||
          oldMemory.users ||
          ""
        ),

      platform:
        String(
          aiMemory.platform ||
          oldMemory.platform ||
          ""
        ),

      currentSystem:
        String(
          aiMemory.currentSystem ||
          oldMemory.currentSystem ||
          ""
        ),

      contact:
        String(
          aiMemory.contact ||
          oldMemory.contact ||
          ""
        ),

      email:
        String(
          aiMemory.email ||
          oldMemory.email ||
          ""
        ),

      leadClosed:
        Boolean(
          aiMemory.leadClosed ||
          oldMemory.leadClosed
        )

    };

    /*
      Final response
    */

    return res.status(200).json({

      reply:
        String(
          result.reply || ""
        ),

      memory:
        safeMemory,

      nextQuestion:
        String(
          result.nextQuestion || ""
        ),

      shouldClose:
        Boolean(
          result.shouldClose ||
          safeMemory.leadClosed
        )

    });

  } catch (error) {

    console.error(
      "SERVER ERROR:",
      error
    );

    return res.status(500).json({

      error:
        error?.message ||
        "Unexpected server error."

    });
  }
}
