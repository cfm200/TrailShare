module.exports = async function (context, req) {
    try {
      const endpoint = process.env.CONTENT_SAFETY_ENDPOINT;
      const key = process.env.CONTENT_SAFETY_KEY;
  
      if (!endpoint || !key) {
        context.res = { status: 500, body: { error: "Missing CONTENT_SAFETY_ENDPOINT / CONTENT_SAFETY_KEY" } };
        return;
      }
  
      const imageUrl = (req.body && (req.body.imageUrl || req.body.url)) || "";
      if (!imageUrl) {
        context.res = { status: 400, body: { error: "imageUrl is required" } };
        return;
      }
  
      const apiUrl = `${endpoint.replace(/\/+$/, "")}/contentsafety/image:analyze?api-version=2024-09-01`;
  
      const payload = {
        image: { blobUrl: imageUrl },
        categories: ["Hate", "SelfHarm", "Sexual", "Violence"]
      };
  
      const r = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": key
        },
        body: JSON.stringify(payload)
      });
  
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        context.res = { status: 502, body: { error: "Content Safety API error", detail: data } };
        return;
      }
  
      const analyses = Array.isArray(data.categoriesAnalysis) ? data.categoriesAnalysis : [];
      const severities = {};
      for (const a of analyses) {
        if (a && a.category) severities[a.category] = a.severity;
      }
  
      const threshold = Number(process.env.CONTENT_SAFETY_THRESHOLD ?? 2);
      const demoStrict = String(process.env.DEMO_STRICT || "false").toLowerCase() === "true";
  
      const maxSeverity = Math.max(0, ...Object.values(severities).map(n => Number(n) || 0));
      const blocked = demoStrict ? true : (maxSeverity >= threshold);
  
      context.res = {
        status: blocked ? 400 : 200,
        body: { ok: !blocked, blocked, demoStrict, threshold, severities, maxSeverity }
      };
    } catch (err) {
      context.res = { status: 500, body: { error: "Server error", detail: err.message } };
    }
  };
  