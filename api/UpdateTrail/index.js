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

    // normalize optional fields
    const nextTitle =
      body.title === undefined || body.title === null ? undefined : String(body.title).trim();
    const nextDescription =
      body.description === undefined || body.description === null ? undefined : String(body.description).trim();
    const nextLocation =
      body.location === undefined || body.location === null ? undefined : String(body.location).trim();

    const updated = {
      ...resource,
      title: nextTitle ?? resource.title,
      description: nextDescription ?? resource.description,
      location: nextLocation ?? resource.location,   // ✅ persists + updates
      media: body.media ?? resource.media,
      updatedAt: new Date().toISOString(),
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
