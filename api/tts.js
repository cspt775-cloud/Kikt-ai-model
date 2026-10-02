module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST method required" });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Voice service is not configured" });
  }

  const text = req.body && req.body.text;

  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Text is required" });
  }

  if (text.length > 1200) {
    return res.status(400).json({ error: "Text is too long" });
  }

  const voiceId = "hpp4J3VqNfWAUOO0d1Us";

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_multilingual_v2"
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs error:", errorText);
      return res.status(502).json({ error: "Voice generation failed" });
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(audioBuffer);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};
