const { getContainer } = require("../shared/cosmos");

module.exports = async function (context, req) {
  try {
    const container = await getContainer();

    const { resources } = await container.items
      .query("SELECT * FROM c ORDER BY c.createdAt DESC")
      .fetchAll();

    context.res = { status: 200, body: resources };
  } catch (err) {
    context.log(err);
    context.res = { status: 500, body: { error: "Server error", detail: err.message } };
  }
};
