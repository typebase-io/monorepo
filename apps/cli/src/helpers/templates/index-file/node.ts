export const nodeIndexFileTemplate = (routerCode: string, port: number, hasAuth: boolean, trustedOrigins: string[]) => {
  const corsSetup = hasAuth && trustedOrigins.length > 0 ? `const TRUSTED_ORIGINS = new Set(${JSON.stringify(trustedOrigins)});` : '';

  const authHandler = (() => {
    if (!hasAuth) return '';

    if (trustedOrigins.length > 0) {
      return `if (req.url?.startsWith("/api/auth")) {
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

    return `if (req.url?.startsWith("/api/auth")) {
    return toNodeHandler(auth)(req, res);
  }`;
  })();

  return `import { createServer } from "node:http";
import { RPCHandler } from "@orpc/server/node";
import { CORSPlugin, RequestHeadersPlugin } from "@orpc/server/plugins";
import { onError } from "@orpc/server";
${hasAuth ? `import { toNodeHandler } from "better-auth/node";\nimport { auth } from "./auth.ts";` : ''}

${routerCode}

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

${corsSetup}

const server = createServer(async (req, res) => {
  ${authHandler}

  const { matched } = await handler.handle(req, res, {
    prefix: "/rpc",
    context: {},
  });

  if (matched) {
    return;
  }

  res.statusCode = 404;
  res.end("Not found");
});

server.listen(${port}, "127.0.0.1", () =>
  console.log("Listening on 127.0.0.1:${port}"),
);
`;
};
