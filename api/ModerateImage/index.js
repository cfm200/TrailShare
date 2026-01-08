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
    const apiKey = process.env.CONTENT_SAFETY_KEY;

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
          "Ocp-Apim-Subscription-Key": apiKey
        }
      }
    );

    const categories = response.data.categoriesAnalysis || [];

    const rejected = categories.some(
      c => c.severity >= 3
    );

    context.res = {
      status: 200,
      body: {
        approved: !rejected,
        analysis: categories
      }
    };

  } catch (err) {
    context.log("ModerateImage error:", err.response?.data || err.message);

    context.res = {
      status: 500,
      body: {
        error: "Content Safety API error",
        detail: err.response?.data || err.message
      }
    };
  }
};
