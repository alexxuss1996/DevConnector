import env from "#config/env";
import fp from "fastify-plugin";
import mongoose from "mongoose";

export default fp(async (fastify) => {
  const uri = env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }
  fastify.log.info("Connecting to MongoDB...");

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
  }

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
