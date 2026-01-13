module.exports = async function (context, req) {
    try {
      const imageUrl = req.body?.imageUrl;
      if (!imageUrl) {
        context.res = { status: 400, body: { error: "imageUrl is required" } };
        return;
      }
  
      const endpoint = process.env.VISION_ENDPOINT;
      const key = process.env.VISION_KEY;
  
      if (!endpoint || !key) {
        context.res = { status: 500, body: { error: "Missing VISION_ENDPOINT or VISION_KEY" } };
        return;
      }
  
      // Vision API (Image Analysis) - generate caption + tags
      const url =
        endpoint.replace(/\/+$/, "") +
        "/computervision/imageanalysis:analyze?api-version=2023-02-01-preview&features=caption,tags";
  
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": key
        },
        body: JSON.stringify({ url: imageUrl })
      });
  
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
  
      if (!r.ok) {
        context.res = { status: 502, body: { error: "Vision API failed", upstreamStatus: r.status, upstream: data } };
        return;
      }
  
      const caption = data?.captionResult?.text || null;
      const tags = Array.isArray(data?.tagsResult?.values)
        ? data.tagsResult.values.slice(0, 6).map(t => t.name)
        : [];
  
      context.res = { status: 200, body: { caption, tags } };
    } catch (err) {
      context.res = { status: 500, body: { error: "Server error", detail: err.message } };
    }
  };
  