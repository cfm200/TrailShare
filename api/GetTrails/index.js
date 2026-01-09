const { getContainer } = require("../shared/cosmos");
const {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} = require("@azure/storage-blob");

module.exports = async function (context, req) {
  const correlationId = context.invocationId;
  const startedAt = Date.now();

  context.log("GetTrails: START", {
    correlationId,
    method: req?.method,
    url: req?.url,
  });

  try {
    const container = await getContainer();

    const queryStartedAt = Date.now();
    const queryResponse = await container.items
      .query("SELECT * FROM c ORDER BY c.createdAt DESC")
      .fetchAll();

    const resources = queryResponse?.resources || [];
    const queryRuCharge =
      queryResponse?.headers?.["x-ms-request-charge"] ??
      queryResponse?.headers?.["x-ms-requestcharge"] ??
      null;

    context.log("GetTrails: Cosmos query complete", {
      correlationId,
      count: resources.length,
      queryDurationMs: Date.now() - queryStartedAt,
      queryRuCharge,
    });

    const accountName = process.env.BLOB_ACCOUNT_NAME;
    const accountKey = process.env.BLOB_ACCOUNT_KEY;
    const containerName = process.env.BLOB_CONTAINER_NAME || "media";

    // If blob config missing, we still return trails (just without imageUrl)
    if (!accountName || !accountKey) {
      const durationMs = Date.now() - startedAt;

      context.log.warn("GetTrails: Blob config missing (returning without SAS urls)", {
        correlationId,
        durationMs,
        hasAccountName: !!accountName,
        hasAccountKey: !!accountKey,
        containerName,
      });

      context.res = { status: 200, body: resources };
      return;
    }

    const cred = new StorageSharedKeyCredential(accountName, accountKey);

    // Add read-only SAS url for each imagePath (DON'T log the SAS)
    let sasCount = 0;
    for (const t of resources) {
      if (t.imagePath) {
        const blobUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${t.imagePath}`;

        const sas = generateBlobSASQueryParameters(
          {
            containerName,
            blobName: t.imagePath,
            permissions: BlobSASPermissions.parse("r"),
            expiresOn: new Date(Date.now() + 15 * 60 * 1000),
          },
          cred
        ).toString();

        t.imageUrl = `${blobUrl}?${sas}`;
        sasCount += 1;
      }
    }

    const durationMs = Date.now() - startedAt;

    context.log("GetTrails: SUCCESS", {
      correlationId,
      returnedCount: resources.length,
      sasGeneratedCount: sasCount,
      durationMs,
    });

    context.res = { status: 200, body: resources };
  } catch (err) {
    const durationMs = Date.now() - startedAt;

    context.log.error("GetTrails: ERROR", {
      correlationId,
      durationMs,
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });

    context.res = { status: 500, body: { error: "Server error", correlationId, detail: err.message } };
  }
};
