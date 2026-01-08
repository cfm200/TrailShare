const axios = require("axios");

module.exports = async function (context, req) {
  try {
    // Accept BOTH formats:
    // 1) { "imageUrl": "https://..." }
    // 2) { "image": { "url": "https://..." } }
    const imageUrl =
      req.body?.imageUrl ||
      req.body?.image?.url ||
      req.body?.url ||
      null;

    if (!imageUrl) {
      context.res = {
        status: 400,
        body: { error: "Missing imageUrl. Send { imageUrl: 'https://...' }" }
      };
      return;
    }

    const endpoint = process.env.CONTENT_SAFETY_ENDPOINT; // e.g. https://<name>.cognitiveservices.azure.com
    const key = process.env.CONTENT_SAFETY_KEY;

    if (!endpoint || !key) {
      context.res = {
        status: 500,
        body: {
          error: "Missing environment variables",
          detail: "Set CONTENT_SAFETY_ENDPOINT and CONTENT_SAFETY_KEY in Function App settings"
        }
      };
      return;
    }

    // Correct Azure AI Content Safety Image Analyze endpoint
    const url = `${endpoint.replace(/\/$/, "")}/contentsafety/image:analyze?api-version=2023-10-01`;

    // ✅ Correct request body for Content Safety
    const payload = {
      image: { url: imageUrl }
    };

    const resp = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": key
      },
      timeout: 15000
    });

    // Response typically contains categoryAnalysis with severities
    // We will compute a simple "allowed" decision:
    const analysis = resp.data?.categoriesAnalysis || resp.data?.categoryAnalysis || [];
    const byCategory = {};
    for (const item of analysis) {
      // item.category: "Hate" | "Sexual" | "Violence" | "SelfHarm"
      // item.severity: 0,2,4,6... depending on API
      if (item?.category) byCategory[item.category] = item.severity;
    }

    // Threshold — tweak if you want:
    // 0 = safe, higher = more severe. We'll reject at >= 2.
    const threshold = 2;
    const failing = Object.entries(byCategory)
      .filter(([, severity]) => typeof severity === "number" && severity >= threshold)
      .map(([cat, sev]) => ({ category: cat, severity: sev }));

    const allowed = failing.length === 0;

    context.res = {
      status: 200,
      body: {
        allowed,
        threshold,
        categories: byCategory,
        failing
      }
    };
  } catch (err) {
    // VERY IMPORTANT: return the upstream error details so you can see what's wrong
    const status = err.response?.status || 500;
    const data = err.response?.data || null;

    context.log("Moderate-image error:", err.message);
    if (data) context.log("Upstream data:", JSON.stringify(data));

    context.res = {
      status: 502, // upstream error
      body: {
        error: "Content Safety call failed",
        message: err.message,
        upstreamStatus: status,
        upstreamData: data
      }
    };
  }
};
