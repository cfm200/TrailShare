const { CosmosClient } = require("@azure/cosmos");

async function getContainer() {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;

  if (!endpoint || !key) {
    throw new Error("Missing COSMOS_ENDPOINT or COSMOS_KEY in app settings.");
  }

  const client = new CosmosClient({ endpoint, key });

  const dbName = process.env.COSMOS_DB_NAME || "trailshare-db";
  const containerName = process.env.COSMOS_CONTAINER_NAME || "trails";

  return client.database(dbName).container(containerName);
}

module.exports = { getContainer };
