const { getContainer } = require("../shared/cosmos");
const {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions
} = require("@azure/storage-blob");

module.exports = async function (context, req) {
  try {
    const container = await getContainer();

    const { resources } = await container.items
      .query("SELECT * FROM c ORDER BY c.createdAt DESC")
      .fetchAll();

    const accountName = process.env.BLOB_ACCOUNT_NAME;
    const accountKey = process.env.BLOB_ACCOUNT_KEY;
    const containerName = process.env.BLOB_CONTAINER_NAME || "media";

    const cred = new StorageSharedKeyCredential(accountName, accountKey);
    const blobService = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      cred
    );

    const now = new Date();
    const expiresOn = new Date(now.getTime() + 10 * 60 * 1000); // 10 mins
    const permissions = BlobSASPermissions.parse("r");

    for (const trail of resources) {
      if (trail.imagePath) {
        const blobClient = blobService
          .getContainerClient(containerName)
          .getBlockBlobClient(trail.imagePath);

        const sas = generateBlobSASQueryParameters(
          {
            containerName,
            blobName: trail.imagePath,
            permissions,
            startsOn: new Date(now.getTime() - 60 * 1000),
            expiresOn
          },
          cred
        ).toString();

        trail.imageUrl = `${blobClient.url}?${sas}`;
      }
    }

    context.res = { status: 200, body: resources };
  } catch (err) {
    context.log(err);
    context.res = { status: 500, body: { error: err.message } };
  }
};
