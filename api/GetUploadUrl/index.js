const {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions
} = require("@azure/storage-blob");

module.exports = async function (context, req) {
  try {
    const { fileName, contentType } = req.body || {};

    if (!fileName) {
      context.res = { status: 400, body: { error: "fileName is required" } };
      return;
    }

    const accountName = process.env.BLOB_ACCOUNT_NAME;
    const accountKey = process.env.BLOB_ACCOUNT_KEY;
    const containerName = process.env.BLOB_CONTAINER_NAME || "media";

    if (!accountName || !accountKey) {
      context.res = {
        status: 500,
        body: { error: "Missing BLOB_ACCOUNT_NAME or BLOB_ACCOUNT_KEY" }
      };
      return;
    }

    // Make filename safe + unique
    const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const blobName = `${Date.now()}_${safeName}`;

    const cred = new StorageSharedKeyCredential(accountName, accountKey);
    const blobService = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      cred
    );

    const containerClient = blobService.getContainerClient(containerName);
    const blobClient = containerClient.getBlockBlobClient(blobName);

    // SAS valid for 60 mins (good for demo + viewing after upload)
    const startsOn = new Date(Date.now() - 60 * 1000);
    const expiresOn = new Date(Date.now() + 60 * 60 * 1000);

    // IMPORTANT: include READ + CREATE + WRITE
    const permissions = BlobSASPermissions.parse("rcw");

    const sas = generateBlobSASQueryParameters(
      {
        containerName,
        blobName,
        permissions,
        startsOn,
        expiresOn,
        contentType: contentType || "application/octet-stream"
      },
      cred
    ).toString();

    const sasUrl = `${blobClient.url}?${sas}`;

    context.res = {
      status: 200,
      body: {
        uploadUrl: sasUrl,
        imageUrl: sasUrl, // use this for <img src="">
        blobName,
        expiresOn: expiresOn.toISOString()
      }
    };
  } catch (err) {
    context.res = { status: 500, body: { error: err.message } };
  }
};
