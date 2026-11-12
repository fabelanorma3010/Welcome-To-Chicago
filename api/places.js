// Vercel Function: proxies Gemini so the API key stays on the server.
// Set GEMINI_API_KEY in Vercel > Project > Settings > Environment Variables.
const MODEL = "gemini-flash-latest";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST" });
  }
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "Server is not configured" });

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body;
  const exclude = Array.isArray(body?.exclude)
    ? body.exclude.slice(0, 30).map((n) => String(n).slice(0, 100))
    : [];

  const prompt =
    "Suggest 6 varied, real, currently operating places for visitors to Chicago, Illinois " +
    "(museums, landmarks, parks, views, neighborhoods, or unique experiences). " +
    "Do not include: Art Institute of Chicago, Shedd Aquarium, 360 Chicago" +
    (exclude.length ? ", " + exclude.join(", ") : "") + ". " +
    "Return a JSON array of objects with keys: name, category (1-2 words), address (street address or neighborhood), " +
    "description (one sentence, max 20 words).";

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 1 },
        }),
      },
    );
    if (!upstream.ok) return res.status(502).json({ error: "Gemini request failed" });
    const data = await upstream.json();
    const places = JSON.parse(data.candidates[0].content.parts[0].text);
    return res.status(200).json({ places });
  } catch {
    return res.status(502).json({ error: "Invalid Gemini response" });
  }
}
;

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
