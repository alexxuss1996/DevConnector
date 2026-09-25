import "#config/env";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import AutoLoad, { AutoloadPluginOptions } from "@fastify/autoload";
import { FastifyPluginAsync, FastifyServerOptions } from "fastify";
import { errorHandler } from "#helpers/error-handler";
import AjvErrors from "ajv-errors";
import addFormats from "ajv-formats";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface AppOptions
  extends FastifyServerOptions, Partial<AutoloadPluginOptions> {}
// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {
  routerOptions: {
    ignoreTrailingSlash: true,
  },
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

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts,
): Promise<void> => {
  // Place here your custom code!

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  await fastify.register(AutoLoad, {
    dir: join(__dirname, "plugins"),
    options: opts,
  });

  // This loads all plugins defined in routes
  // define your routes in one of these
  await fastify.register(AutoLoad, {
    dir: join(__dirname, "routes"),
    options: opts,
    dirNameRoutePrefix: true,
  });
  // Custom error handler
  fastify.setErrorHandler(errorHandler);
  fastify.ready(() => {
    if (process.env.NODE_ENV !== "production") {
      fastify.log.info(fastify.printRoutes());
    }
  });
};

export default app;
export { app, options };
