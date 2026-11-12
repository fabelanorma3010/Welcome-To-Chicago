// Vercel Function: the "Chi" guide assistant. Proxies Gemini so the API key stays on the server.
// Uses the same GEMINI_API_KEY environment variable as api/places.js.
const MODEL = "gemini-flash-latest";

const SYSTEM =
  "You are Chi, a friendly, concise local guide for a Chicago visitor website. " +
  "Help with things to do, coffee shops, neighborhoods, food, getting around (CTA 'L' trains, buses, Divvy bikes, walking) and itineraries. " +
  "Only recommend real places and be honest when unsure about hours or prices. " +
  "Keep answers under 90 words, in plain text with no markdown. Politely decline unrelated topics.";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST" });
  }
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "Server is not configured" });

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body;
  const messages = Array.isArray(body?.messages) ? body.messages.slice(-8) : [];
  const contents = messages
    .filter((m) => m && (m.role === "user" || m.role === "model") && typeof m.text === "string")
    .map((m) => ({ role: m.role, parts: [{ text: m.text.slice(0, 500) }] }));
  if (!contents.length || contents[contents.length - 1].role !== "user") {
    return res.status(400).json({ error: "Send a user message" });
  }

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
        }),
      },
    );
    if (!upstream.ok) return res.status(502).json({ error: "Gemini request failed" });
    const data = await upstream.json();
    const reply = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim();
    if (!reply) return res.status(502).json({ error: "Empty response" });
    return res.status(200).json({ reply });
  } catch {
    return res.status(502).json({ error: "Invalid Gemini response" });
  }
};

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
