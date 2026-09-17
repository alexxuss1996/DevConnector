import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import scalar from "@scalar/fastify-api-reference";

export default fp(async (fastify) => {
  // Swagger (OpenAPI) - must be before routes
  await fastify.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "DevConnector API",
        description:
          "Interactive API documentation for DevConnector - a social network for developers. Try endpoints directly from the browser.",
        version: "1.0.0",
        contact: {
          name: "DevConnector",
        },
      },
      servers: [
        {
          url: "http://localhost:4000",
          description: "Development server",
        },
      ],
      tags: [
        { name: "Auth", description: "Authentication & session" },
        { name: "Profile", description: "User profiles, experience, education" },
        { name: "Posts", description: "Posts, likes, comments" },
        { name: "System", description: "Health / root" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "Paste access token from login/register response (Authorization: Bearer <token>)",
          },
          cookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "refreshToken",
            description: "Refresh token is set as httpOnly cookie on login/register",
          },
        },
      },
    },
    // hide routes marked with { hide: true } and respect tags
    // TypeBox schemas are JSON-Schema compatible, no custom transform needed
    // but we add a small transform to auto-hide docs routes themselves if needed
  });

  // Swagger UI at /docs
  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
    },
    staticCSP: true,
  });

  // Scalar (modern alternative) at /reference
  await fastify.register(scalar, {
    routePrefix: "/reference",
    configuration: {
      theme: "purple",
      metaData: {
        title: "DevConnector API",
        description: "DevConnector API Reference - modern interactive docs",
      },
      // defaults to using the spec from @fastify/swagger
      layout: "modern",
      showSidebar: true,
      hideDownloadButton: false,
    },
  });
});
