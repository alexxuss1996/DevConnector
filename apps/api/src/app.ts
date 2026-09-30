import { isProduction, trustedProxyHops } from "#config/env";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import AutoLoad from "@fastify/autoload";
import fp from "fastify-plugin";
import Fastify, {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyPluginOptions,
  FastifyRequest,
  FastifyServerOptions,
} from "fastify";
import { errorHandler } from "#helpers/error-handler";
import { baseOptions, registerRequestIdHook } from "#helpers/request-id";
import authPlugin from "#plugins/auth";
import cookiePlugin from "#plugins/cookie";
import corsPlugin from "#plugins/cors";
import csrfPlugin from "#plugins/csrf";
import helmetPlugin from "#plugins/helmet";
import jwtPlugin from "#plugins/jwt";
import mongoosePlugin from "#plugins/mongoose";
import oauthPlugin from "#plugins/oauth";
import rateLimitPlugin from "#plugins/rate-limit";
import swaggerPlugin from "#plugins/swagger";
import AjvErrors from "ajv-errors";
import addFormats from "ajv-formats";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * The plugins that reach outside the process, so a test can substitute them.
 *
 * This list used to be discovered by autoloading src/plugins. That made
 * deletion of a plugin file invisible: the compiler had no import to fail and
 * the test harness hand-registered its own subset, so every test passed while
 * production broke. Registering explicitly trades a little convenience for a
 * build failure when the wiring and the filesystem disagree.
 */
export interface PluginOverrides {
  oauth?: FastifyPluginAsync<FastifyPluginOptions>;
  db?: FastifyPluginAsync<FastifyPluginOptions>;
  rateLimitKey?: (request: FastifyRequest) => string;
  /**
   * Registered inside the app, before it readies. A test can use this to add
   * its own routes — the `authenticate` decorator needs one to guard, and
   * `createApp` readies the instance, so a route added afterwards is
   * rejected. `app` is fp()-wrapped, so the routes land on the same instance
   * the caller gets back.
   */
  extraRoutes?: (app: FastifyInstance) => void;
}

export interface AppOptions extends FastifyServerOptions {
  overrides?: PluginOverrides;
}

// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {
  routerOptions: {
    ignoreTrailingSlash: true,
  },
  ...baseOptions,
  // `request.ip` is the connection peer unless this is set, and the rate-limit
  // plugin keys every bucket on it. Two failure modes pull in opposite
  // directions, so this is opt-in and defaults to trusting nothing:
  //
  //   - No proxy (direct exposure, local dev): trusting a hop makes
  //     `request.ip` the client-supplied X-Forwarded-For, so a caller rotates
  //     that header and gets an unlimited supply of rate-limit buckets. An
  //     attacker then brute-forces /auth/login at any rate.
  //   - Behind a proxy: NOT trusting it makes every request look like it came
  //     from the proxy, collapsing the 5/min login cap into one site-wide
  //     bucket that a single client can lock every user out of.
  //
  // Neither is knowable at boot, so the deployment states it. `true` is never
  // accepted: it trusts the whole chain, which is the no-proxy case again.
  // `TRUST_PROXY_HOPS=1` for a single reverse proxy or load balancer; validated
  // in src/config/env.ts so a typo fails at boot instead of silently reverting
  // to trusting nothing.
  trustProxy: trustedProxyHops(),
  logger: {
    // Through the same helper the cookie flag uses: a direct
    // `=== "production"` read here would accept a typo'd NODE_ENV that
    // `isProduction` rejects, so debug logging could be enabled in a
    // deployment the rest of the code treats as misconfigured.
    level: process.env.LOG_LEVEL ?? (isProduction() ? "info" : "debug"),
    redact: ["req.headers.authorization", "req.headers.cookie", "req.cookies"],
  },
  ajv: {
    customOptions: {
      coerceTypes: false,
      allErrors: true,
      strict: false,
    },
    plugins: [AjvErrors as any, addFormats as any],
  },
};

const app = fp<AppOptions>(async (fastify, opts): Promise<void> => {
  const {
    oauth = oauthPlugin,
    db = mongoosePlugin,
    rateLimitKey,
    extraRoutes,
  } = opts.overrides ?? {};

  // Order is load-bearing and matches what autoload's alphabetical sort
  // produced: `auth` decorates `authenticate`, and `csrf` adds an onRequest
  // hook, both of which must exist before the routes registered below.
  await fastify.register(authPlugin);
  await fastify.register(cookiePlugin);
  await fastify.register(corsPlugin);
  await fastify.register(csrfPlugin);
  await fastify.register(helmetPlugin);
  await fastify.register(jwtPlugin);
  await fastify.register(db);
  await fastify.register(oauth);
  await fastify.register(
    rateLimitPlugin,
    rateLimitKey ? { keyGenerator: rateLimitKey } : {},
  );
  await fastify.register(swaggerPlugin);

  // Before the routes, not after: avvio creates each registered plugin's
  // encapsulated context when the register call is made, and the context
  // inherits the error handler present at that moment. Setting it afterwards
  // leaves every route with Fastify's default handler.
  fastify.setErrorHandler(errorHandler);
  registerRequestIdHook(fastify);

  // Routes stay autoloaded: production and tests call this same line, so a
  // route file added to src/routes is live in both with no edit to either.
  await fastify.register(AutoLoad, {
    dir: join(__dirname, "routes"),
    options: opts,
    dirNameRoutePrefix: true,
  });

  extraRoutes?.(fastify);

  fastify.ready(() => {
    if (process.env.NODE_ENV !== "production") {
      fastify.log.info(fastify.printRoutes());
    }
  });
});

/**
 * Boots the same wiring the CLI boots, with substitutions. `overrides` is
 * destructured out rather than spread into Fastify(), which does not know
 * that option.
 */
export async function createApp(
  opts: Partial<FastifyServerOptions> & { overrides?: PluginOverrides } = {},
): Promise<FastifyInstance> {
  const { overrides, ...serverOpts } = opts;
  const server = Fastify({ ...options, ...serverOpts });
  await server.register(app, { overrides });
  await server.ready();
  return server;
}

export default app;
export { app, options };
