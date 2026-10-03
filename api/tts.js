module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST method required"
    });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "ELEVENLABS_API_KEY is missing in Vercel"
    });
  }

  const text = req.body?.text;

  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({
      error: "Text is required"
    });
  }

  const voiceId = "hpp4J3VqNfWAUOO0d1Us";

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",

        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg"
        },

        body: JSON.stringify({
          text: text.trim(),

          model_id: "eleven_multilingual_v2",

          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.8,
            style: 0.2,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "ELEVENLABS ERROR:",
        response.status,
        errorText
      );

      return res.status(502).json({
        error: "ElevenLabs voice generation failed",
        status: response.status,
        details: errorText
      });
    }

    const audioBuffer = Buffer.from(
      await response.arrayBuffer()
    );

    if (!audioBuffer.length) {
      return res.status(502).json({
        error: "ElevenLabs returned empty audio"
      });
    }

    res.setHeader(
      "Content-Type",
      "audio/mpeg"
    );

    res.setHeader(
      "Content-Length",
      audioBuffer.length
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    return res.status(200).send(audioBuffer);

  } catch (error) {

    console.error(
      "TTS SERVER ERROR:",
      error
    );

    return res.status(500).json({
      error: "TTS server error",
      details: error.message
    });
  }
};
