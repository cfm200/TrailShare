const axios = require("axios");

module.exports = async function (context, req) {
  try {
    const imageUrl = req.body?.imageUrl;
    if (!imageUrl) {
      context.res = { status: 400, body: { error: "imageUrl is required" } };
      return;
    }

    // 1. Download image as binary
    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer"
    });

    const imageBase64 = Buffer.from(imageResponse.data).toString("base64");

    // 2. Send image bytes to Content Safety
    const endpoint = process.env.CONTENT_SAFETY_ENDPOINT;
    const key = process.env.CONTENT_SAFETY_KEY;

    const safetyResponse = await axios.post(
      `${endpoint}/contentsafety/image:analyze?api-version=2023-10-01`,
      {
        image: {
          content: imageBase64
        },
        categories: ["Sexual", "Violence", "SelfHarm"],
        outputType: "FourSeverityLevels"
      },
      {
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "application/json"
        }
      }
    );

    const results = safetyResponse.data.categoriesAnalysis;

    const rejected = results.some(
      r => r.severity >= 3
    );

    context.res = {
      status: 200,
      body: {
        approved: !rejected,
        analysis: results
      }
    };

  } catch (err) {
    context.log("Moderation error:", err.response?.data || err.message);
    context.res = {
      status: 500,
      body: {
        error: "Moderation failed",
        detail: err.response?.data || err.message
      }
    };
  }
};
