const { getContainer } = require("../shared/cosmos");

module.exports = async function (context, req) {
  try {
    const trailId = context.bindingData.trailId;
    const body = req.body || {};
    const container = await getContainer();

    const { resource } = await container.item(trailId, trailId).read();
    if (!resource) {
      context.res = { status: 404, body: { error: "Not found" } };
      return;
    }

    const updated = {
      ...resource,
      title: body.title ?? resource.title,
      description: body.description ?? resource.description,
      location: body.location ?? resource.location,
      media: body.media ?? resource.media,
      updatedAt: new Date().toISOString()
    };

    await container.item(trailId, trailId).replace(updated);
    context.res = { status: 200, body: updated };
  } catch (err) {
    if (String(err.code) === "404") {
      context.res = { status: 404, body: { error: "Not found" } };
      return;
    }
    context.log(err);
    context.res = { status: 500, body: { error: "Server error", detail: err.message } };
  }
};
