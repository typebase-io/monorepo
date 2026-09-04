import { normalizeServerPath } from '#helpers/shared/normalize-server-path.ts';
import { serverPathPrefix } from '#helpers/shared/server-path-prefix.ts';
import { authPathExpressions } from '#helpers/templates/server-file/auth-path-expressions.ts';
import { type ServerFileOptions } from '#helpers/templates/server-file/options.ts';
import { rpcPlugins, rpcPluginsImport, setsCorsHeaders } from '#helpers/templates/server-file/rpc-plugins.ts';

export const honoServerFileTemplate = ({ routerCode, hasAuth, trustedOrigins, mode, actionsPath, authPath }: ServerFileOptions) => {
  const authImports = [
    hasAuth ? `import { auth } from "./auth.ts";` : '',
    setsCorsHeaders(mode) && hasAuth && trustedOrigins.length > 0 ? `import { cors } from "hono/cors";` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const authCors =
    setsCorsHeaders(mode) && hasAuth && trustedOrigins.length > 0
      ? `app.use(
	${authPathExpressions(authPath).wildcard},
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
    ? `app.all(${authPathExpressions(authPath).wildcard}, (c) => {
  return auth.handler(c.req.raw);
});`
    : '';

  const authBlocks = [authCors, authRoute].filter(Boolean).join('\n\n');
  const authBlocksSection = authBlocks ? `${authBlocks}\n\n` : '';

  return `import { Hono } from "hono";
import { RPCHandler } from "@orpc/server/fetch";
${rpcPluginsImport(mode)}
import { onError } from "@orpc/server";
${authImports ? `${authImports}\n` : ''}
${routerCode}

const app = new Hono();

const handler = new RPCHandler(router, {
${rpcPlugins(mode)}
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

${authBlocksSection}app.use(${JSON.stringify(`${normalizeServerPath(actionsPath)}/*`)}, async (c, next) => {
  const request = new Proxy(c.req.raw, {
    get(target, prop) {
      if (BODY_PARSER_METHODS.has(prop as BodyParserMethod)) {
        return () => c.req[prop as BodyParserMethod]();
      }

      return Reflect.get(target, prop, target);
    },
  });

  const { matched, response } = await handler.handle(request, {
    prefix: ${JSON.stringify(serverPathPrefix(actionsPath))},
    context: {},
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
});

export const typebaseHandler = app;
${hasAuth ? '\nexport { auth };\n' : ''}`;
};
