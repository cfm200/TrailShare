const { getContainer } = require("../shared/cosmos");

module.exports = async function (context, req) {
  // Create a simple correlation id for linking logs across a single request
  const correlationId =
    context.invocationId || `inv_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const startedAt = Date.now();

  try {
    const body = req.body || {};

    const title = (body.title || "").trim();
    const description = (body.description || "").trim();
    const location = (body.location || "").trim();

    // 🔑 IMPORTANT: store imagePath ONLY (not SAS URL)
    const imagePath = body.imagePath ? String(body.imagePath) : null;
    const media = Array.isArray(body.media) ? body.media.map(String) : [];

    // ---- Telemetry: request received ----
    context.log("CreateTrail: request received", {
      correlationId,
      hasBody: !!req.body,
      hasImage: !!imagePath,
      titleLength: title.length,
      descriptionLength: description.length,
      locationLength: location.length,
      mediaCount: media.length
    });

    // --- Validation ---
    if (title.length < 2 || title.length > 80) {
      context.log("CreateTrail: validation failed", {
        correlationId,
        field: "title",
        reason: "Title must be 2–80 characters",
        titleLength: title.length
      });

      context.res = { status: 400, body: { error: "Title must be 2–80 characters." } };
      return;
    }

    if (description.length > 500) {
      context.log("CreateTrail: validation failed", {
        correlationId,
        field: "description",
        reason: "Description must be <= 500 characters",
        descriptionLength: description.length
      });

      context.res = {
        status: 400,
        body: { error: "Description must be 500 characters or fewer." }
      };
      return;
    }

    if (location.length > 120) {
      context.log("CreateTrail: validation failed", {
        correlationId,
        field: "location",
        reason: "Location must be <= 120 characters",
        locationLength: location.length
      });

      context.res = {
        status: 400,
        body: { error: "Location must be 120 characters or fewer." }
      };
      return;
    }

    if (imagePath && imagePath.length > 300) {
      context.log("CreateTrail: validation failed", {
        correlationId,
        field: "imagePath",
        reason: "imagePath is too long",
        imagePathLength: imagePath.length
      });

      context.res = { status: 400, body: { error: "imagePath is too long." } };
      return;
    }

    const now = new Date().toISOString();
    const trailId = body.trailId ? String(body.trailId) : `trail_${Date.now()}`;

    // 🔑 id === partition key (/trailId)
    const doc = {
      id: trailId,
      trailId,
      title,
      description,
      location,
      imagePath,
      media,
      createdAt: now,
      updatedAt: now
    };

    // ---- Telemetry: Cosmos write start ----
    context.log("CreateTrail: writing to Cosmos", {
      correlationId,
      trailId,
      partitionKey: trailId // since your partition key is /trailId
    });

    const container = await getContainer();
    await container.items.create(doc);

    const durationMs = Date.now() - startedAt;

    // ---- Telemetry: success ----
    context.log("CreateTrail: success", {
      correlationId,
      trailId,
      durationMs
    });

    context.res = {
      status: 201,
      body: doc
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;

    // ---- Telemetry: error ----
    context.log("CreateTrail: error", {
      correlationId,
      durationMs,
      message: err?.message,
      name: err?.name,
      stack: err?.stack
    });

    context.res = {
      status: 500,
      body: { error: "Server error", detail: err.message }
    };
  }
};
