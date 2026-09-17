import Type from "typebox";

export const EnvSchema = Type.Object({
  JWT_SECRET: Type.String(),
  MONGODB_URI: Type.String(),
  FRONTEND_URL: Type.String({
    format: "url",
  }),
  GITHUB_ACCESS_TOKEN: Type.String(),
  GOOGLE_CLIENT_SECRET: Type.String(),
  GOOGLE_CLIENT_ID: Type.String(),
  GOOGLE_CALLBACK_URL: Type.String({
    format: "url",
  }),
});

export type Env = Type.Static<typeof EnvSchema>;

const env = {
  get JWT_SECRET(): string {
    return process.env.JWT_SECRET as string;
  },
  get MONGODB_URI(): string {
    return process.env.MONGODB_URI as string;
  },
  get FRONTEND_URL(): string {
    return process.env.FRONTEND_URL as string;
  },
  get GITHUB_ACCESS_TOKEN(): string {
    return process.env.GITHUB_ACCESS_TOKEN as string;
  },
  get GOOGLE_CLIENT_SECRET(): string {
    return process.env.GOOGLE_CLIENT_SECRET as string;
  },
  get GOOGLE_CLIENT_ID(): string {
    return process.env.GOOGLE_CLIENT_ID as string;
  },
  get GOOGLE_CALLBACK_URL(): string {
    return process.env.GOOGLE_CALLBACK_URL as string;
  },
} as Env;

export default env;

if (!env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}

if (!env.MONGODB_URI) {
  throw new Error("MONGODB_URI is not set");
}

if (!env.GITHUB_ACCESS_TOKEN) {
  throw new Error("GITHUB_ACCESS_TOKEN is not set");
}

if (!env.GOOGLE_CLIENT_SECRET) {
  throw new Error("GOOGLE_CLIENT_SECRET is not set");
}

if (!env.GOOGLE_CLIENT_ID) {
  throw new Error("GOOGLE_CLIENT_ID is not set");
}

if (!env.GOOGLE_CALLBACK_URL) {
  throw new Error("GOOGLE_CALLBACK_URL is not set");
}
