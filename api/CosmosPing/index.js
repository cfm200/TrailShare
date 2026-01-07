const { CosmosClient } = require("@azure/cosmos");

module.exports = async function (context, req) {
  try {
    const endpoint = process.env.COSMOS_ENDPOINT;
    const key = process.env.COSMOS_KEY;
    const dbName = process.env.COSMOS_DB_NAME || "trailshare-db";
    const containerName = process.env.COSMOS_CONTAINER_NAME || "trails";

    // Don’t print secrets, just booleans + partial endpoint
    if (!endpoint || !key) {
      context.res = {
        status: 500,
        body: {
          ok: false,
          reason: "Missing COSMOS_ENDPOINT or COSMOS_KEY",
          COSMOS_ENDPOINT_set: !!endpoint,
          COSMOS_KEY_set: !!key
        }
      };
      return;
    }

    const client = new CosmosClient({ endpoint, key });

    // Lightweight calls that prove auth + DB/container existence
    const db = client.database(dbName);
    const { resource: dbInfo } = await db.read();

    const container = db.container(containerName);
    const { resource: containerInfo } = await container.read();

    context.res = {
      status: 200,
      body: {
        ok: true,
        node: process.version,
        endpointHost: new URL(endpoint).host,
        db: dbInfo?.id,
        container: containerInfo?.id,
        partitionKey: containerInfo?.partitionKey?.paths
      }
    };
  } catch (err) {
    context.res = {
      status: 500,
      body: {
        ok: false,
        node: process.version,
        name: err.name,
        code: err.code,
        message: err.message
      }
    };
  }
};
