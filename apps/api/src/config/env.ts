/** Required env vars and how to validate them, checked once at import. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `KEY=value` pairs from env-file content. Handles `export` prefixes,
 * `#` comments, and single/double quotes. Single-line values only — enough
 * for every var this service reads (see REQUIRED below).
 */
function parseEnvFile(path: string): Map<string, string> {
  const vars = new Map<string, string>();
  if (!existsSync(path)) return vars;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    let value = match[2].trim();
    const quote = value[0];
    if (value.length >= 2 && (quote === '"' || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, "\n").replace(/\\"/g, '"');
    } else {
      const comment = value.search(/\s#/);
      if (comment !== -1) value = value.slice(0, comment).trim();
    }
    vars.set(match[1], value);
  }
  return vars;
}

/**
 * `.env.local` overrides for development, mirroring the Next.js convention:
 * `.env` holds shared/deployed values, `.env.local` the machine-local ones.
 * Loaded only when NODE_ENV is unset or `development` — never in
 * test/staging/production, so a stray local file cannot shadow a real
 * deployment or test run.
 *
 * `process.loadEnvFile` cannot do this: it never overrides keys already set,
 * and fastify-cli has already loaded `.env` by the time this module runs.
 * So `.env.local` replaces file-sourced values, never a variable exported in
 * the real environment.
 */
{
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === undefined || nodeEnv === "" || nodeEnv === "development") {
    const cwd = process.cwd();
    const fileVars = parseEnvFile(join(cwd, ".env"));
    for (const [key, value] of parseEnvFile(join(cwd, ".env.local"))) {
      // A defined value that differs from `.env` can only come from the real
      // environment (env files never override it), so it is left alone.
      const current = process.env[key];
      if (current === undefined || current === fileVars.get(key)) process.env[key] = value;
    }
  }
}
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

/**
 * Whether cookies should carry the `Secure` flag.
 *
 * The auth cookies are the only credential in the system, and the refresh
 * token lives for 30 days — a `Secure` flag that is silently off leaks a
 * month-long credential over the first plaintext request. Reading
 * `NODE_ENV === "production"` directly made that a one-typo failure:
 * `NODE_ENV=prod`, `=staging`, or `=Production` all mean "production" to a
 * human and all meant "insecure" to the code.
 *
 * So an unrecognised value is a boot error rather than a silent downgrade.
 * Unset is treated as development, which is the only environment that
 * legitimately serves over plain HTTP.
 */
const PRODUCTION = "production";
const KNOWN_ENVIRONMENTS = new Set([
  "development",
  "test",
  "staging",
  PRODUCTION,
]);

// Validate NODE_ENV at import, not only on first use. `isProduction` is
// reached from request handling, so without this a typo'd value boots fine and
// then turns every login into a 500 discovered under live traffic. Unset stays
// legal and means development.
{
  const nodeEnv = process.env.NODE_ENV;
  if (
    nodeEnv !== undefined &&
    nodeEnv !== "" &&
    !KNOWN_ENVIRONMENTS.has(nodeEnv)
  ) {
    throw new Error(
      `Invalid env: NODE_ENV must be one of ${[...KNOWN_ENVIRONMENTS].join(", ")} (got "${nodeEnv}")`,
    );
  }
}

export function isProduction(): boolean {
  const value = process.env.NODE_ENV;
  if (value === undefined || value === "") return false;
  if (!KNOWN_ENVIRONMENTS.has(value)) {
    throw new Error(
      `Invalid env: NODE_ENV must be one of ${[...KNOWN_ENVIRONMENTS].join(", ")} (got "${value}")`,
    );
  }
  return value === PRODUCTION;
}

/**
 * How many proxy hops to trust when deriving `request.ip`.
 *
 * Defaults to `false` (trust nothing) because the safe default depends on the
 * deployment and only the deployment knows: see the `trustProxy` comment in
 * app.ts.
 *
 * Only a genuinely empty value counts as unset — `TRUST_PROXY_HOPS=` is a
 * common way to write "off" in a compose file, and that is unambiguous. Every
 * other value has to be an integer, because the cost of reading a typo as unset
 * is the silent one: the operator believes they fixed the rate-limit collapse
 * behind their proxy, and get the pre-change behaviour instead with no signal.
 * `Number(" 1 ")` is `1`, so incidental whitespace around a real count is fine.
 */
export function trustedProxyHops(): number | false {
  const raw = process.env.TRUST_PROXY_HOPS;
  if (raw === undefined || raw === "") return false;
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 1) {
    throw new Error(
      `Invalid env: TRUST_PROXY_HOPS must be an integer >= 1 when set (got "${raw}")`,
    );
  }
  return hops;
}
