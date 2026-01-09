const { getContainer } = require("../shared/cosmos");

module.exports = async function (context, req) {
  const correlationId = context.invocationId;
  const startedAt = Date.now();

  const trailId = context.bindingData?.trailId;

  context.log("GetTrail: START", {
    correlationId,
    method: req?.method,
    url: req?.url,
    trailId,
  });

  try {
    if (!trailId) {
      context.log.warn("GetTrail: validation failed", {
        correlationId,
        reason: "Missing trailId in route",
      });
      context.res = { status: 400, body: { error: "trailId is required", correlationId } };
      return;
    }

    const container = await getContainer();
    const readResponse = await container.item(trailId, trailId).read();

    const resource = readResponse?.resource;

    if (!resource) {
      const durationMs = Date.now() - startedAt;
      context.log.warn("GetTrail: NOT FOUND (null resource)", {
        correlationId,
        trailId,
        durationMs,
      });
      context.res = { status: 404, body: { error: "Not found", correlationId } };
      return;
    }

    const ruCharge =
      readResponse?.headers?.["x-ms-request-charge"] ??
      readResponse?.headers?.["x-ms-requestcharge"] ??
      null;

    const durationMs = Date.now() - startedAt;

    context.log("GetTrail: SUCCESS", {
      correlationId,
      trailId,
      ruCharge,
      durationMs,
    });

    context.res = { status: 200, body: resource };
  } catch (err) {
    const durationMs = Date.now() - startedAt;

    // Cosmos throws 404 for missing item
    if (String(err.code) === "404") {
      context.log.warn("GetTrail: NOT FOUND (Cosmos 404)", {
        correlationId,
        trailId,
        durationMs,
      });
      context.res = { status: 404, body: { error: "Not found", correlationId } };
      return;
    }

    context.log.error("GetTrail: ERROR", {
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
