const axios = require("axios");

module.exports = async function (context, req) {
  try {
    const imageUrl = req.body?.imageUrl;

    if (!imageUrl) {
      context.res = {
        status: 400,
        body: { error: "imageUrl is required" }
      };
      return;
    }

    const endpoint = process.env.CONTENT_SAFETY_ENDPOINT;
    const key = process.env.CONTENT_SAFETY_KEY;

    if (!endpoint || !key) {
      context.res = {
        status: 500,
        body: { error: "Content Safety env vars not set" }
      };
      return;
    }

    const response = await axios.post(
      `${endpoint}/contentsafety/image:analyze?api-version=2023-10-01`,
      {
        image: {
          url: imageUrl
        }
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": key
        }
      }
    );

    const result = response.data;

    // Simple rule: reject if ANY category is high confidence
    const flagged = Object.values(result.categoriesAnalysis || {}).some(
      c => c.severity >= 4
    );

    context.res = {
      status: 200,
      body: {
        safe: !flagged,
        analysis: result
      }
    };
  } catch (err) {
    context.log("Content Safety error:", err.response?.data || err.message);
    context.res = {
      status: 500,
      body: {
        error: "Content Safety API error",
        detail: err.response?.data || err.message
      }
    };
  }
};
