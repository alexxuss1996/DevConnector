import fp from "fastify-plugin";
import mongoose from "mongoose";

declare module "fastify" {
  interface FastifyInstance {
    db: typeof mongoose.connection;
  }
}

export default fp(async (fastify) => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }
  fastify.log.info("Connecting to MongoDB...");

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  fastify.log.info("Connected to MongoDB Atlas");

  fastify.decorate("db", mongoose.connection);

  fastify.addHook("onClose", async () => {
    await mongoose.disconnect();
  });
});
