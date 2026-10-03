export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "OPENAI_API_KEY is missing in Vercel environment variables."
    });
  }

  try {
    const messages = req.body?.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Conversation messages are required." });
    }

    const safeMessages = messages
      .filter((item) =>
        item &&
        ["user", "assistant"].includes(item.role) &&
        typeof item.content === "string"
      )
      .slice(-16)
      .map((item) => ({
        role: item.role,
        content: item.content.slice(0, 3000)
      }));

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        instructions: `
You are Bella, a friendly female AI voice assistant for KIKT Software Solutions.

Your job is to speak naturally with potential customers and understand their software requirements.

LANGUAGE AND STYLE:
- Speak in natural conversational Tamil mixed with commonly used English words (Tanglish).
- Do not use formal literary Tamil.
- Sound warm, polite, friendly, and professional.
- Address the customer as "சார்" naturally, but do not repeat it in every sentence.
- Keep replies short and easy to understand because the reply will be spoken aloud.
- Usually reply in 1 to 3 sentences.
- Do not repeat the same generic reply.
- Never say that you are using scripted replies.

CONVERSATION:
- Understand the customer's exact question.
- Remember and use details from earlier messages in this conversation.
- Ask only one relevant follow-up question at a time.
- If the customer gives a clear answer, acknowledge it and move to the next useful question.
- Do not ask for information the customer has already provided.
- If the customer asks about website, mobile app, billing software, inventory, CRM, or custom software, ask relevant questions to understand their business and required features.
- If they ask about price, explain that pricing depends on scope and features. Ask what they need before giving an estimate.
- Do not invent KIKT's exact prices, delivery timelines, client names, guarantees, or technical capabilities.
- If you do not know a company-specific fact, say politely that the KIKT team can confirm it.
- Do not give the same answer to unrelated questions.
- Do not pretend that a booking, quotation, or callback has been arranged unless the customer actually completed that action.

Example:
Customer: "எங்களுக்கு billing software வேணும்"
Assistant: "சரி சார். எந்த business-க்காக billing software தேவை? Retail shop-ஆ, wholesale business-ஆ?"

Customer: "Textile shop"
Assistant: "சரி சார், textile shop-க்கு billing கூட stock management-ம் தேவைப்படுமா? GST billing பயன்படுத்துறீங்களா?"

Respond only with the words you want Bella to speak. Do not include labels like "Bella:".
        `,
        input: safeMessages,
        max_output_tokens: 180
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);
      return res.status(response.status).json({
        error: data.error?.message || "AI response could not be generated."
      });
    }

    let reply = "";

    if (Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === "message" && Array.isArray(item.content)) {
          for (const part of item.content) {
            if (part.type === "output_text" && part.text) {
              reply += part.text;
            }
          }
        }
      }
    }

    reply = reply.trim();

    if (!reply) {
      return res.status(500).json({
        error: "AI returned an empty reply."
      });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("Chat backend error:", error);

    return res.status(500).json({
      error: "Chat service error: " + error.message
    });
  }
}
