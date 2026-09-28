import "#config/env";
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
  logger: {
    level:
      process.env.LOG_LEVEL ??
      (process.env.NODE_ENV === "production" ? "info" : "debug"),
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
  const { oauth = oauthPlugin, db = mongoosePlugin, rateLimitKey, extraRoutes } =
    opts.overrides ?? {};

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
