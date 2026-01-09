const { getContainer } = require("../shared/cosmos");

module.exports = async function (context, req) {
  const correlationId = context.invocationId;
  const startedAt = Date.now();

  const trailId = context.bindingData?.trailId;

  context.log("DeleteTrail: START", {
    correlationId,
    method: req?.method,
    url: req?.url,
    trailId,
  });

  try {
    if (!trailId) {
      context.log.warn("DeleteTrail: validation failed", {
        correlationId,
        reason: "Missing trailId in route",
      });
      context.res = { status: 400, body: { error: "trailId is required", correlationId } };
      return;
    }

    const container = await getContainer();

    const delResponse = await container.item(trailId, trailId).delete();

    const ruCharge =
      delResponse?.headers?.["x-ms-request-charge"] ??
      delResponse?.headers?.["x-ms-requestcharge"] ??
      null;

    const durationMs = Date.now() - startedAt;

    context.log("DeleteTrail: DELETED", {
      correlationId,
      trailId,
      ruCharge,
      durationMs,
    });

    context.res = { status: 204 };
  } catch (err) {
    const durationMs = Date.now() - startedAt;

    // Cosmos not found
    if (String(err.code) === "404") {
      context.log.warn("DeleteTrail: NOT FOUND", {
        correlationId,
        trailId,
        durationMs,
      });
      context.res = { status: 404, body: { error: "Not found", correlationId } };
      return;
    }

    context.log.error("DeleteTrail: ERROR", {
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
