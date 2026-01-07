const { getContainer } = require("../shared/cosmos");

module.exports = async function (context, req) {
  try {
    const trailId = context.bindingData.trailId;
    const container = await getContainer();

    await container.item(trailId, trailId).delete();
    context.res = { status: 204 };
  } catch (err) {
    if (String(err.code) === "404") {
      context.res = { status: 404, body: { error: "Not found" } };
      return;
    }
    context.log(err);
    context.res = { status: 500, body: { error: "Server error", detail: err.message } };
  }
};
