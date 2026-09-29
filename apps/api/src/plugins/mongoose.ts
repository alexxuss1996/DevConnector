import env from "#config/env";
import fp from "fastify-plugin";
import mongoose from "mongoose";

// This plugin is the only caller of `mongoose.connect`, so the URI it connected
// to is recorded here. Reading `mongoose.connection._connectionString` instead
// reaches into private Mongoose state, which has no compatibility guarantee.
let connectedUri: string | undefined;

export default fp(async (fastify) => {
  const uri = env.MONGODB_URI;

  const disconnectOnClose = () => {
    fastify.addHook("onClose", async () => {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        connectedUri = undefined;
      }
    });
  };

  // Already connected to the same URI: skip reconnecting, but still take
  // ownership of the close hook. Returning before registering it left this app
  // closing without disconnecting, so the connection outlived it.
  if (mongoose.connection.readyState === 1 && connectedUri === uri) {
    fastify.log.info("MongoDB already connected");
    disconnectOnClose();
    return;
  }

  // Disconnect if connected to a different URI
  if (mongoose.connection.readyState !== 0) {
    fastify.log.info("Disconnecting from previous MongoDB connection");
    await mongoose.disconnect();
  }

  fastify.log.info("Connecting to MongoDB...");

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
  });
  connectedUri = uri;

  fastify.log.info("Connected to MongoDB");

  disconnectOnClose();
});
