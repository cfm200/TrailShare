module.exports = async function (context, req) {
    context.res = {
      status: 200,
      body: {
        ok: true,
        time: new Date().toISOString(),
        node: process.version
      }
    };
  };
  