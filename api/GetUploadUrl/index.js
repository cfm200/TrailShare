const {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} = require("@azure/storage-blob");

module.exports = async function (context, req) {
  const correlationId = context.invocationId;
  const startedAt = Date.now();

  context.log("GetUploadUrl: START", {
    correlationId,
    method: req?.method,
    url: req?.url,
  });

  try {
    const { fileName, contentType } = req.body || {};

    if (!fileName) {
      context.log.warn("GetUploadUrl: validation failed", {
        correlationId,
        reason: "fileName is required",
      });
      context.res = { status: 400, body: { error: "fileName is required", correlationId } };
      return;
    }

    const accountName = process.env.BLOB_ACCOUNT_NAME;
    const accountKey = process.env.BLOB_ACCOUNT_KEY;
    const containerName = process.env.BLOB_CONTAINER_NAME || "media";

    if (!accountName || !accountKey) {
      context.log.error("GetUploadUrl: Blob config missing", {
        correlationId,
        hasAccountName: !!accountName,
        hasAccountKey: !!accountKey,
        containerName,
      });
      context.res = { status: 500, body: { error: "Blob config missing", correlationId } };
      return;
    }

    const safeName = String(fileName).replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const blobName = `${Date.now()}_${safeName}`; // permanent path

    const cred = new StorageSharedKeyCredential(accountName, accountKey);
    const blobService = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      cred
    );

    const containerClient = blobService.getContainerClient(containerName);
    const blobClient = containerClient.getBlockBlobClient(blobName);

    const startsOn = new Date(Date.now() - 60 * 1000);
    const expiresOn = new Date(Date.now() + 15 * 60 * 1000);
    const permissions = BlobSASPermissions.parse("cw"); // create + write ONLY

    // Log what we're generating (WITHOUT the SAS itself)
    context.log("GetUploadUrl: generating SAS", {
      correlationId,
      containerName,
      blobName,
      permissions: "cw",
      expiresInMinutes: 15,
      contentType: contentType || "application/octet-stream",
    });

    const sas = generateBlobSASQueryParameters(
      {
        containerName,
        blobName,
        permissions,
        startsOn,
        expiresOn,
        contentType: contentType || "application/octet-stream",
      },
      cred
    ).toString();

    const durationMs = Date.now() - startedAt;

    context.log("GetUploadUrl: SUCCESS", {
      correlationId,
      containerName,
      blobName,
      durationMs,
    });

    context.res = {
      status: 200,
      body: {
        uploadUrl: `${blobClient.url}?${sas}`, // used once
        imagePath: blobName,
        telemetry: {
          correlationId,
          durationMs,
          expiresOn: expiresOn.toISOString(),
          permissions: "cw",
        },
      },
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;

    context.log.error("GetUploadUrl: ERROR", {
      correlationId,
      durationMs,
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });

    context.res = { status: 500, body: { error: "Server error", correlationId, detail: err.message } };
  }
};
