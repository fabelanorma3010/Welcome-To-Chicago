// Vercel Function: returns every named cafe in Chicago from OpenStreetMap (Overpass).
// Overpass rejects requests without a descriptive User-Agent, so the browser can't call it directly.
const QUERY =
  '[out:json][timeout:60];nwr["amenity"="cafe"]["name"](41.64,-87.94,42.02,-87.52);out center tags;';
const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

module.exports = async function handler(req, res) {
  for (const endpoint of ENDPOINTS) {
    try {
      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "WelcomeToChicago/1.0 (https://github.com/fabelanorma3010/Welcome-To-Chicago)",
        },
        body: new URLSearchParams({ data: QUERY }),
      });
      if (!upstream.ok) continue;
      const data = await upstream.json();
      const shops = data.elements
        .map((e) => {
          const t = e.tags || {};
          const lat = e.lat ?? e.center?.lat;
          const lon = e.lon ?? e.center?.lon;
          if (!t.name || lat == null || lon == null || ["private", "no"].includes(t.access)) return null;
          return {
            name: t.name,
            address: [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" "),
            lat: Math.round(lat * 1e5) / 1e5,
            lon: Math.round(lon * 1e5) / 1e5,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));
      res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
      return res.status(200).json({ shops });
    } catch {}
  }
  return res.status(502).json({ error: "Could not load coffee shops" });
};
