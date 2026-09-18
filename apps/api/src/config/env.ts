import { Type } from "typebox";

export const EnvSchema = Type.Object({
  JWT_SECRET: Type.String({ minLength: 32 }),
  MONGODB_URI: Type.String({ minLength: 1 }),
  FRONTEND_URL: Type.String({
    format: "uri",
  }),
  GITHUB_ACCESS_TOKEN: Type.String({ minLength: 1 }),
  GOOGLE_CLIENT_SECRET: Type.String({ minLength: 1 }),
  GOOGLE_CLIENT_ID: Type.String({ minLength: 1 }),
  GOOGLE_CALLBACK_URL: Type.String({
    format: "uri",
  }),
});

export type Env = Type.Static<typeof EnvSchema>;

function required(name: keyof Env): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

const env = {
  get JWT_SECRET(): string {
    return required("JWT_SECRET");
  },
  get MONGODB_URI(): string {
    return required("MONGODB_URI");
  },
  get FRONTEND_URL(): string {
    return required("FRONTEND_URL");
  },
  get GITHUB_ACCESS_TOKEN(): string {
    return required("GITHUB_ACCESS_TOKEN");
  },
  get GOOGLE_CLIENT_SECRET(): string {
    return required("GOOGLE_CLIENT_SECRET");
  },
  get GOOGLE_CLIENT_ID(): string {
    return required("GOOGLE_CLIENT_ID");
  },
  get GOOGLE_CALLBACK_URL(): string {
    return required("GOOGLE_CALLBACK_URL");
  },
} as Env;

export default env;

const missing = (Object.keys(EnvSchema.properties) as (keyof Env)[]).filter(
  (key) => !process.env[key],
);
if (missing.length > 0) {
  throw new Error(`Missing required env vars: ${missing.join(", ")}`);
}

if ((process.env.JWT_SECRET?.length ?? 0) < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters");
}
