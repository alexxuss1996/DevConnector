/** Required env vars and how to validate them, checked once at import. */
const REQUIRED = {
  JWT_SECRET: (v: string) =>
    v.length >= 32 ? undefined : "must be >= 32 characters",
  MONGODB_URI: (v: string) => (v ? undefined : "must not be empty"),
  FRONTEND_URL: (v: string) =>
    URL.canParse(v) ? undefined : "must be a valid URL",
  GITHUB_ACCESS_TOKEN: (v: string) => (v ? undefined : "must not be empty"),
  GOOGLE_CLIENT_SECRET: (v: string) => (v ? undefined : "must not be empty"),
  GOOGLE_CLIENT_ID: (v: string) => (v ? undefined : "must not be empty"),
  GOOGLE_CALLBACK_URL: (v: string) =>
    URL.canParse(v) ? undefined : "must be a valid URL",
} as const;

export type Env = { readonly [K in keyof typeof REQUIRED]: string };

const invalid: string[] = [];
for (const [name, check] of Object.entries(REQUIRED)) {
  const value = process.env[name];
  const problem = value === undefined ? "is not set" : check(value);
  if (problem) invalid.push(`${name} ${problem}`);
}
if (invalid.length > 0) {
  throw new Error(`Invalid env: ${invalid.join(", ")}`);
}

// Lazy getters: a test may delete a var at runtime, so an access after boot
// must still throw rather than hand back `undefined`.
const env = {} as Env;
for (const name of Object.keys(REQUIRED) as (keyof Env)[]) {
  Object.defineProperty(env, name, {
    get() {
      const value = process.env[name];
      if (!value) throw new Error(`${name} is not set`);
      return value;
    },
  });
}

export default env;
