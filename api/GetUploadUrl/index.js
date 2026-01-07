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
        context.res = { status: 500, body: { error: "Blob env vars missing" } };
        return;
      }
  
      // Clean filename + make unique
      const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const blobName = `${Date.now()}_${safeName}`;
  
      const cred = new StorageSharedKeyCredential(accountName, accountKey);
      const blobService = new BlobServiceClient(
        `https://${accountName}.blob.core.windows.net`,
        cred
      );
  
      const containerClient = blobService.getContainerClient(containerName);
      const blobClient = containerClient.getBlockBlobClient(blobName);
  
      // SAS valid for 10 minutes (plenty for upload)
      const startsOn = new Date(Date.now() - 60 * 1000);
      const expiresOn = new Date(Date.now() + 10 * 60 * 1000);
  
      const sas = generateBlobSASQueryParameters(
        {
          containerName,
          blobName,
          permissions: BlobSASPermissions.parse("cw"), // create + write
          startsOn,
          expiresOn,
          contentType: contentType || "application/octet-stream"
        },
        cred
      ).toString();
  
      context.res = {
        status: 200,
        body: {
          uploadUrl: `${blobClient.url}?${sas}`,
          blobUrl: blobClient.url, // store this in Cosmos for display
          blobName
        }
      };
    } catch (err) {
      context.res = { status: 500, body: { error: err.message } };
    }
  };
  