export const honoIndexFileTemplate = (routerCode: string, hasAuth: boolean, trustedOrigins: string[]) => {
  const authImports = [
    hasAuth ? `import { auth } from "./auth.ts";` : '',
    hasAuth && trustedOrigins.length > 0 ? `import { cors } from "hono/cors";` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const authCors =
    hasAuth && trustedOrigins.length > 0
      ? `app.use(
	"/api/auth/*",
	cors({
		origin: [${trustedOrigins.map((origin) => JSON.stringify(origin)).join(', ')}],
		allowHeaders: ["Content-Type", "Authorization"],
		allowMethods: ["POST", "GET", "OPTIONS"],
		exposeHeaders: ["Content-Length"],
		maxAge: 600,
		credentials: true,
	}),
);`
      : '';

  const authRoute = hasAuth
    ? `app.all("/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});`
    : '';

  const authBlocks = [authCors, authRoute].filter(Boolean).join('\n\n');
  const authBlocksSection = authBlocks ? `${authBlocks}\n\n` : '';

  return `import { Hono } from "hono";
import { RPCHandler } from "@orpc/server/fetch";
import { CORSPlugin, RequestHeadersPlugin } from "@orpc/server/plugins";
import { onError } from "@orpc/server";
${authImports ? `${authImports}\n` : ''}
${routerCode}

const app = new Hono();

const handler = new RPCHandler(router, {
  plugins: [
    new CORSPlugin({
      origin: (origin, options) => origin,
      allowMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH'],
    }),
    new RequestHeadersPlugin(),
  ],
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

const BODY_PARSER_METHODS = new Set([
  "arrayBuffer",
  "blob",
  "formData",
  "json",
  "text",
] as const);

type BodyParserMethod = typeof BODY_PARSER_METHODS extends Set<infer T> ? T : never;

${authBlocksSection}app.use("/rpc/*", async (c, next) => {
  const request = new Proxy(c.req.raw, {
    get(target, prop) {
      if (BODY_PARSER_METHODS.has(prop as BodyParserMethod)) {
        return () => c.req[prop as BodyParserMethod]();
      }

      return Reflect.get(target, prop, target);
    },
  });

  const { matched, response } = await handler.handle(request, {
    prefix: "/rpc",
    context: {},
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
});

export default app;
`;
};
