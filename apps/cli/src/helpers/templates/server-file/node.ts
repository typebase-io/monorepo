import { indentLines } from '#helpers/shared/indent-lines.ts';
import { normalizeServerPath } from '#helpers/shared/normalize-server-path.ts';
import { serverPathPrefix } from '#helpers/shared/server-path-prefix.ts';
import { authPathCondition } from '#helpers/templates/server-file/auth-path-condition.ts';
import { loggingInterceptors } from '#helpers/templates/server-file/logging-interceptors.ts';
import { type ServerFileOptions } from '#helpers/templates/server-file/options.ts';
import { requestLogger } from '#helpers/templates/server-file/request-logger.ts';
import { rpcPlugins, rpcPluginsImport, setsCorsHeaders } from '#helpers/templates/server-file/rpc-plugins.ts';

export const nodeServerFileTemplate = ({
  routerCode,
  hasAuth,
  trustedOrigins,
  mode,
  actionsPath,
  authPath,
  storagePath,
  logging = false,
}: ServerFileOptions) => {
  const returnHandled = logging ? 'return await' : 'return';

  const corsSetup =
    setsCorsHeaders(mode) && hasAuth && trustedOrigins.length > 0
      ? `const TRUSTED_ORIGINS = new Set([${trustedOrigins.map((origin) => JSON.stringify(origin)).join(', ')}]);`
      : '';

  const authHandler = (() => {
    if (!hasAuth) return '';

    if (setsCorsHeaders(mode) && trustedOrigins.length > 0) {
      return `if (${authPathCondition(authPath)}) {
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

    ${returnHandled} toNodeHandler(auth)(req, res);
  }`;
    }

    return `if (${authPathCondition(authPath)}) {
    ${returnHandled} toNodeHandler(auth)(req, res);
  }`;
  })();

  const storageHandler =
    storagePath === undefined
      ? ''
      : `if (pathname === ${JSON.stringify(normalizeServerPath(storagePath))} || pathname.startsWith(${JSON.stringify(normalizeServerPath(storagePath))} + "/")) {
    ${returnHandled} handleNodeRequest(localFileStorage.handle, req, res);
  }`;

  const routeHandlers = [authHandler, storageHandler].filter(Boolean);

  const pathHandlers =
    routeHandlers.length === 0 ? '' : ['const pathname = new URL(req.url ?? "/", "http://localhost").pathname;', ...routeHandlers].join('\n\n  ');

  const handlerBody = `${pathHandlers ? `  ${pathHandlers}\n\n` : ''}  const { matched } = await handler.handle(req, res, {
    prefix: ${JSON.stringify(serverPathPrefix(actionsPath))},
    context: ${logging ? '{ [LOG_ENTRY]: requestLog.entry } as {}' : '{}'},
  });

  if (matched) {
    return;
  }

  if (next) {
    next();
    return;
  }

  res.statusCode = 404;
  res.end("Not found");`;

  const loggedHandlerBody = `  const requestLog = startRequestLog(req, res);

  try {
${indentLines(handlerBody)}
  } catch (error) {
    requestLog.fail(error);

    throw error;
  }`;

  return `import type { IncomingMessage, ServerResponse } from "node:http";
import { RPCHandler } from "@orpc/server/node";
${rpcPluginsImport(mode)}
import { onError } from "@orpc/server";
${logging ? 'import pino from "pino";\nimport pretty from "pino-pretty";\n' : ''}${hasAuth ? `import { toNodeHandler } from "better-auth/node";\nimport { auth } from "./auth.ts";\n` : ''}${storagePath === undefined ? '' : `import { handleNodeRequest } from "typebase-io/internal/local-storage";\nimport { localFileStorage } from "./storage.ts";\n`}
${routerCode}
${logging ? `\n${requestLogger}\n` : ''}
const handler = new RPCHandler(router, {
${rpcPlugins(mode)}${
    logging
      ? `\n${loggingInterceptors}`
      : `
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],`
  }
});

${corsSetup ? `${corsSetup}\n\n` : ''}export const typebaseHandler = async (req: IncomingMessage, res: ServerResponse, next?: (error?: unknown) => void) => {
${logging ? loggedHandlerBody : handlerBody}
};
${hasAuth ? '\nexport { auth };\n' : ''}`;
};
