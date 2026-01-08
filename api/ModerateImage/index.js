module.exports = async function (context, req) {
  // Always return JSON, always include debug
  const debug = {
    hasBody: !!req.body,
    bodyKeys: req.body ? Object.keys(req.body) : [],
    hasEndpointEnv: !!process.env.CONTENT_SAFETY_ENDPOINT,
    hasKeyEnv: !!process.env.CONTENT_SAFETY_KEY,
    endpointPreview: process.env.CONTENT_SAFETY_ENDPOINT
      ? String(process.env.CONTENT_SAFETY_ENDPOINT).slice(0, 40) + "..."
      : null,
    nodeVersion: process.version
  };

  try {
    const imageUrl = req.body?.imageUrl || req.body?.image?.url || null;

    if (!imageUrl) {
      context.res = { status: 400, body: { error: "Missing imageUrl", debug } };
      return;
    }

    const endpoint = process.env.CONTENT_SAFETY_ENDPOINT;
    const key = process.env.CONTENT_SAFETY_KEY;

    if (!endpoint || !key) {
      context.res = {
        status: 500,
        body: { error: "Missing CONTENT_SAFETY_ENDPOINT or CONTENT_SAFETY_KEY", debug }
      };
      return;
    }

    const apiUrl =
      endpoint.replace(/\/+$/, "") +
      "/contentsafety/image:analyze?api-version=2023-10-01";

    const payload = { image: { url: imageUrl } };

    const r = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": key
      },
      body: JSON.stringify(payload)
    });

    const text = await r.text(); // don't assume JSON
    let data = null;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    // Return upstream details so we can see the real reason
    context.res = {
      status: r.ok ? 200 : 502,
      body: {
        ok: r.ok,
        upstreamStatus: r.status,
        upstreamResponse: data,
        debug
      }
    };
  } catch (err) {
    context.res = {
      status: 500,
      body: {
        error: "Function crashed",
        message: err?.message || String(err),
        stack: err?.stack || null,
        debug
      }
    };
  }
};
