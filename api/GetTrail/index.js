const { getContainer } = require("../shared/cosmos");

module.exports = async function (context, req) {
  try {
    const trailId = context.bindingData.trailId;
    const container = await getContainer();

    const { resource } = await container.item(trailId, trailId).read();

    if (!resource) {
      context.res = { status: 404, body: { error: "Not found" } };
      return;
    }

    context.res = { status: 200, body: resource };
  } catch (err) {
    // If item doesn't exist, Cosmos throws. Treat as 404.
    if (String(err.code) === "404") {
      context.res = { status: 404, body: { error: "Not found" } };
      return;
    }
    context.log(err);
    context.res = { status: 500, body: { error: "Server error", detail: err.message } };
  }
};
