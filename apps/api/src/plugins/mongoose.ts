import env from "#config/env";
import fp from "fastify-plugin";
import mongoose from "mongoose";

export default fp(async (fastify) => {
  const uri = env.MONGODB_URI;

  // If already connected to the same URI, skip reconnecting
  if (
    mongoose.connection.readyState === 1 &&
    (mongoose.connection as any)._connectionString === uri
  ) {
    fastify.log.info("MongoDB already connected");
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

  fastify.log.info("Connected to MongoDB");

  fastify.addHook("onClose", async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
});
