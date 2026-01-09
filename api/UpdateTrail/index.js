const { getContainer } = require("../shared/cosmos");

module.exports = async function (context, req) {
  const correlationId = context.invocationId;
  const startedAt = Date.now();

  const trailId = context.bindingData?.trailId;

  context.log("UpdateTrail: START", {
    correlationId,
    method: req?.method,
    url: req?.url,
    trailId,
  });

  try {
    if (!trailId) {
      context.log.warn("UpdateTrail: validation failed", {
        correlationId,
        reason: "Missing trailId in route",
      });
      context.res = { status: 400, body: { error: "trailId is required", correlationId } };
      return;
    }

    const body = req.body || {};
    const container = await getContainer();

    // Read existing
    const readResponse = await container.item(trailId, trailId).read();
    const resource = readResponse?.resource;

    if (!resource) {
      const durationMs = Date.now() - startedAt;
      context.log.warn("UpdateTrail: NOT FOUND (null resource)", {
        correlationId,
        trailId,
        durationMs,
      });
      context.res = { status: 404, body: { error: "Not found", correlationId } };
      return;
    }

    // normalize optional fields
    const nextTitle =
      body.title === undefined || body.title === null ? undefined : String(body.title).trim();
    const nextDescription =
      body.description === undefined || body.description === null ? undefined : String(body.description).trim();
    const nextLocation =
      body.location === undefined || body.location === null ? undefined : String(body.location).trim();

    // Log which fields are being updated (not the whole content)
    const changedFields = [];
    if (nextTitle !== undefined) changedFields.push("title");
    if (nextDescription !== undefined) changedFields.push("description");
    if (nextLocation !== undefined) changedFields.push("location");
    if (body.media !== undefined) changedFields.push("media");

    context.log("UpdateTrail: applying changes", {
      correlationId,
      trailId,
      changedFields,
    });

    const updated = {
      ...resource,
      title: nextTitle ?? resource.title,
      description: nextDescription ?? resource.description,
      location: nextLocation ?? resource.location,
      media: body.media ?? resource.media,
      updatedAt: new Date().toISOString(),
    };

    const replaceResponse = await container.item(trailId, trailId).replace(updated);

    const ruCharge =
      replaceResponse?.headers?.["x-ms-request-charge"] ??
      replaceResponse?.headers?.["x-ms-requestcharge"] ??
      null;

    const durationMs = Date.now() - startedAt;

    context.log("UpdateTrail: SUCCESS", {
      correlationId,
      trailId,
      changedFields,
      ruCharge,
      durationMs,
    });

    context.res = { status: 200, body: updated };
  } catch (err) {
    const durationMs = Date.now() - startedAt;

    if (String(err.code) === "404") {
      context.log.warn("UpdateTrail: NOT FOUND (Cosmos 404)", {
        correlationId,
        trailId,
        durationMs,
      });
      context.res = { status: 404, body: { error: "Not found", correlationId } };
      return;
    }

    context.log.error("UpdateTrail: ERROR", {
      correlationId,
      trailId,
      durationMs,
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });

    context.res = { status: 500, body: { error: "Server error", correlationId, detail: err.message } };
  }
};
