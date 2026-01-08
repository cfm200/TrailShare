const { getContainer } = require("../shared/cosmos");
const {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions
} = require("@azure/storage-blob");

module.exports = async function (context) {
  const container = await getContainer();
  const { resources } = await container.items
    .query("SELECT * FROM c ORDER BY c.createdAt DESC")
    .fetchAll();

  const accountName = process.env.BLOB_ACCOUNT_NAME;
  const accountKey = process.env.BLOB_ACCOUNT_KEY;
  const containerName = process.env.BLOB_CONTAINER_NAME || "media";
  const cred = new StorageSharedKeyCredential(accountName, accountKey);

  for (const t of resources) {
    if (t.imagePath) {
      const blobUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${t.imagePath}`;

      const sas = generateBlobSASQueryParameters({
        containerName,
        blobName: t.imagePath,
        permissions: BlobSASPermissions.parse("r"),
        expiresOn: new Date(Date.now() + 15 * 60 * 1000)
      }, cred).toString();

      t.imageUrl = `${blobUrl}?${sas}`;
    }
  }

  context.res = { status: 200, body: resources };
};
