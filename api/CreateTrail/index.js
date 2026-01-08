const { getContainer } = require("../shared/cosmos");

module.exports = async function (context, req) {
  try {
    const body = req.body || {};

    const title = (body.title || "").trim();
    const description = (body.description || "").trim();
    const location = (body.location || "").trim();

    // ✅ STORE IMAGE PATH, NOT SAS URL
    // Example: media/trail_123/photo.jpg
    const imagePath = body.imagePath ? String(body.imagePath) : null;

    const media = Array.isArray(body.media) ? body.media.map(String) : [];

    // --- Validation ---
    if (title.length < 2 || title.length > 80) {
      context.res = { status: 400, body: { error: "Title must be 2-80 characters." } };
      return;
    }
    if (description.length > 500) {
      context.res = { status: 400, body: { error: "Description must be 500 characters or fewer." } };
      return;
    }
    if (location.length > 120) {
      context.res = { status: 400, body: { error: "Location must be 120 characters or fewer." } };
      return;
    }
    if (imagePath && imagePath.length > 500) {
      context.res = { status: 400, body: { error: "imagePath is too long." } };
      return;
    }

    const now = new Date().toISOString();
    const trailId = body.trailId ? String(body.trailId) : `trail_${Date.now()}`;

    // IMPORTANT: id = trailId, partition key = /trailId
    const doc = {
      id: trailId,
      trailId,
      title,
      description,
      location,
      imagePath,        // ✅ FIXED
      media,
      createdAt: now,
      updatedAt: now,
    };

    const container = await getContainer();
    await container.items.create(doc);

    context.res = { status: 201, body: doc };
  } catch (err) {
    context.log("CreateTrail error:", err);
    context.res = { status: 500, body: { error: "Server error", detail: err.message } };
  }
};
