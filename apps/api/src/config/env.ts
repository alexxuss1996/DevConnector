import Type from "@sinclair/typebox";

export const EnvSchema = Type.Object({
  JWT_SECRET: Type.String(),
  MONGODB_URI: Type.String(),
});

const env = {
  JWT_SECRET: process.env.JWT_SECRET!,
  MONGODB_URI: process.env.MONGODB_URI!,
};

export type Env = Type.Static<typeof EnvSchema>;

export default env;

if (!env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}

if (!env.MONGODB_URI) {
  throw new Error("MONGODB_URI is not set");
}
