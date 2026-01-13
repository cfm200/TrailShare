const { getContainer } = require("../shared/cosmos");

function safeStr(v) {
  return v === null || v === undefined ? "" : String(v);
}

function buildPublicBlobUrl(imagePath) {
  const account = process.env.BLOB_ACCOUNT_NAME;
  const container = process.env.BLOB_CONTAINER_NAME || "media";
  if (!account || !imagePath) return null;
  return `https://${account}.blob.core.windows.net/${container}/${imagePath}`;
}

async function analyzeWithVision(context, imageUrl, correlationId) {
  const endpoint = process.env.VISION_ENDPOINT;
  const key = process.env.VISION_KEY;

  if (!endpoint || !key || !imageUrl) {
    return { caption: null, tags: [] };
  }

  const apiUrl =
    endpoint.replace(/\/+$/, "") +
    "/computervision/imageanalysis:analyze?api-version=2023-02-01-preview&features=caption,tags";

  try {
    const r = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": key
      },
      body: JSON.stringify({ url: imageUrl })
    });

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!r.ok) {
      context.log("CreateTrail: AI Vision upstream error (non-blocking)", {
        correlationId,
        upstreamStatus: r.status,
        upstream: data
      });
      return { caption: null, tags: [] };
    }

    const caption = data?.captionResult?.text || null;
    const tags = Array.isArray(data?.tagsResult?.values)
      ? data.tagsResult.values.slice(0, 6).map(t => t.name).filter(Boolean)
      : [];

    return { caption, tags };
  } catch (err) {
    context.log("CreateTrail: AI Vision call failed (non-blocking)", {
      correlationId,
      message: err?.message
    });
    return { caption: null, tags: [] };
  }
}

module.exports = async function (context, req) {
  const correlationId =
    context.invocationId ||
    `inv_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const startedAt = Date.now();
  const method = req?.method || "UNKNOWN";
  const url = req?.url || "UNKNOWN";

  context.log("CreateTrail: START", { correlationId, method, url });

  try {
    const body = req.body || {};

    const title = safeStr(body.title).trim();
    const description = safeStr(body.description).trim();
    const location = safeStr(body.location).trim();

    // Store imagePath ONLY (not SAS URL)
    const imagePath = body.imagePath ? String(body.imagePath) : null;
    const media = Array.isArray(body.media) ? body.media.map(String) : [];

    context.log("CreateTrail: request received", {
      correlationId,
      hasBody: !!req.body,
      hasImage: !!imagePath,
      titleLength: title.length,
      descriptionLength: description.length,
      locationLength: location.length,
      mediaCount: media.length
    });

    // Validation
    if (title.length < 2 || title.length > 80) {
      context.log("CreateTrail: validation failed", {
        correlationId,
        field: "title",
        reason: "Title must be 2–80 characters",
        titleLength: title.length
      });
      context.res = { status: 400, body: { error: "Title must be 2–80 characters.", correlationId } };
      return;
    }

    if (description.length > 500) {
      context.log("CreateTrail: validation failed", {
        correlationId,
        field: "description",
        reason: "Description must be <= 500 characters",
        descriptionLength: description.length
      });
      context.res = { status: 400, body: { error: "Description must be 500 characters or fewer.", correlationId } };
      return;
    }

    if (location.length > 120) {
      context.log("CreateTrail: validation failed", {
        correlationId,
        field: "location",
        reason: "Location must be <= 120 characters",
        locationLength: location.length
      });
      context.res = { status: 400, body: { error: "Location must be 120 characters or fewer.", correlationId } };
      return;
    }

    if (imagePath && imagePath.length > 300) {
      context.log("CreateTrail: validation failed", {
        correlationId,
        field: "imagePath",
        reason: "imagePath is too long",
        imagePathLength: imagePath.length
      });
      context.res = { status: 400, body: { error: "imagePath is too long.", correlationId } };
      return;
    }

    const now = new Date().toISOString();
    const trailId = body.trailId ? String(body.trailId) : `trail_${Date.now()}`;

    // Optional AI Vision analysis (does NOT block creation)
    const publicImageUrl = buildPublicBlobUrl(imagePath);
    context.log("CreateTrail: AI analysis (optional) start", {
      correlationId,
      hasVisionEnv: !!process.env.VISION_ENDPOINT && !!process.env.VISION_KEY,
      hasPublicImageUrl: !!publicImageUrl
    });

    const { caption: aiCaption, tags: aiTags } = await analyzeWithVision(
      context,
      publicImageUrl,
      correlationId
    );

    context.log("CreateTrail: AI analysis (optional) result", {
      correlationId,
      hasCaption: !!aiCaption,
      tagCount: aiTags.length
    });

    const doc = {
      id: trailId,
      trailId,
      title,
      description,
      location,
      imagePath,
      media,
      createdAt: now,
      updatedAt: now,

      // ✅ NEW AI fields (Cosmos schema-less; no migrations needed)
      aiCaption: aiCaption || null,
      aiTags: Array.isArray(aiTags) ? aiTags : [],
      aiAnalyzedAt: (aiCaption || (aiTags && aiTags.length)) ? now : null
    };

    context.log("CreateTrail: writing to Cosmos", {
      correlationId,
      trailId,
      partitionKey: trailId
    });

    const container = await getContainer();
    const createResponse = await container.items.create(doc);

    const ruCharge =
      createResponse?.headers?.["x-ms-request-charge"] ??
      createResponse?.headers?.["x-ms-requestcharge"] ??
      createResponse?.headers?.["request-charge"] ??
      null;

    const cosmosStatusCode =
      createResponse?.statusCode ?? createResponse?.response?.statusCode ?? null;

    const durationMs = Date.now() - startedAt;

    context.log("CreateTrail: CREATED TRAIL", {
      correlationId,
      trailId: doc.trailId,
      title: doc.title,
      hasImagePath: !!doc.imagePath,
      mediaCount: doc.media?.length || 0,
      hasAiCaption: !!doc.aiCaption,
      aiTagCount: doc.aiTags?.length || 0,
      cosmosStatusCode,
      ruCharge,
      durationMs
    });

    context.res = {
      status: 201,
      body: {
        ...doc,
        telemetry: { correlationId, durationMs, ruCharge }
      }
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;

    context.log("CreateTrail: ERROR", {
      correlationId,
      durationMs,
      message: err?.message,
      name: err?.name,
      stack: err?.stack
    });

    context.res = {
      status: 500,
      body: { error: "Server error", correlationId, detail: err?.message }
    };
  }
};
