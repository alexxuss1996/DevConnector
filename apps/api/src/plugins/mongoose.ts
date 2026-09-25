import env from "#config/env";
import fp from "fastify-plugin";
import mongoose from "mongoose";

export default fp(async (fastify) => {
  const uri = env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  // If already connected to the same URI, skip reconnecting
  if (
    mongoose.connection.readyState === 1 &&
    (mongoose.connection as any)._connectionString === uri
  ) {
    fastify.log.info("MongoDB already connected");
    if (!fastify.hasDecorator("db")) {
      fastify.decorate("db", mongoose.connection);
    }
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

  if (!fastify.hasDecorator("db")) {
    fastify.decorate("db", mongoose.connection);
  }

  fastify.addHook("onClose", async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
});
