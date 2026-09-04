import { serverPathPrefix } from '#helpers/shared/server-path-prefix.ts';
import { authPathCondition } from '#helpers/templates/server-file/auth-path-condition.ts';
import { type ServerFileOptions } from '#helpers/templates/server-file/options.ts';
import { rpcPlugins, rpcPluginsImport, setsCorsHeaders } from '#helpers/templates/server-file/rpc-plugins.ts';

export const nodeServerFileTemplate = ({ routerCode, hasAuth, trustedOrigins, mode, actionsPath, authPath }: ServerFileOptions) => {
  const corsSetup =
    setsCorsHeaders(mode) && hasAuth && trustedOrigins.length > 0
      ? `const TRUSTED_ORIGINS = new Set([${trustedOrigins.map((origin) => JSON.stringify(origin)).join(', ')}]);`
      : '';

  const authHandler = (() => {
    if (!hasAuth) return '';

    if (setsCorsHeaders(mode) && trustedOrigins.length > 0) {
      return `const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

  if (${authPathCondition(authPath)}) {
    const origin = req.headers.origin;

    if (typeof origin === "string" && TRUSTED_ORIGINS.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Max-Age", "600");
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    return toNodeHandler(auth)(req, res);
  }`;
    }

    return `const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

  if (${authPathCondition(authPath)}) {
    return toNodeHandler(auth)(req, res);
  }`;
  })();

  return `import type { IncomingMessage, ServerResponse } from "node:http";
import { RPCHandler } from "@orpc/server/node";
${rpcPluginsImport(mode)}
import { onError } from "@orpc/server";
${hasAuth ? `import { toNodeHandler } from "better-auth/node";\nimport { auth } from "./auth.ts";\n` : ''}
${routerCode}

const handler = new RPCHandler(router, {
${rpcPlugins(mode)}
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

${corsSetup ? `${corsSetup}\n\n` : ''}export const typebaseHandler = async (req: IncomingMessage, res: ServerResponse, next?: (error?: unknown) => void) => {${authHandler ? `\n  ${authHandler}\n` : ''}
  const { matched } = await handler.handle(req, res, {
    prefix: ${JSON.stringify(serverPathPrefix(actionsPath))},
    context: {},
  });

  if (matched) {
    return;
  }

  if (next) {
    next();
    return;
  }

  res.statusCode = 404;
  res.end("Not found");
};
${hasAuth ? '\nexport { auth };\n' : ''}`;
};
