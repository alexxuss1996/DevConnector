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
  try {
    await mongoose.connect(uri);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  fastify.log.info("Connected to MongoDB Atlas");

  fastify.addHook("onClose", async (fastify) => {
    await mongoose.disconnect();
  });

  fastify.decorate("db", mongoose.connection);
});
