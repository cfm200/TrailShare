const { getContainer } = require("../shared/cosmos");

module.exports = async function (context, req) {
  try {
    const body = req.body || {};
    const title = (body.title || "").trim();
    const imageUrl = body.imageUrl;

    if (!title) {
      context.res = { status: 400, body: { error: "title is required" } };
      return;
    }
    if (!title || title.trim().length < 2 || title.length > 80) {
      context.res = { status: 400, body: { error: "Title must be 2-80 characters." } };
      return;
    }
    if (description && description.length > 500) {
      context.res = { status: 400, body: { error: "Description must be 500 characters or fewer." } };
      return;
    }
    if (imageUrl && typeof imageUrl !== "string") {
      context.res = { status: 400, body: { error: "imageUrl must be a string." } };
      return;
    }
    

    const now = new Date().toISOString();
    const trailId = body.trailId || `trail_${Date.now()}`;

    // IMPORTANT: id == trailId (makes point reads/deletes easy)
    const doc = {
      id: trailId,
      trailId,
      title,
      description: body.description || "",
      imageUrl: imageUrl || null,
      location: body.location || null,
      media: body.media || [],
      createdAt: now,
      updatedAt: now
    };

    const container = await getContainer();
    await container.items.create(doc);

    context.res = { status: 201, body: doc };
  } catch (err) {
    context.log(err);
    context.res = { status: 500, body: { error: "Server error", detail: err.message } };
  }
};
