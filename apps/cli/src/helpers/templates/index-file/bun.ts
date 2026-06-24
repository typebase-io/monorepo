export const bunIndexFileTemplate = (routerCode: string, port: number, hasAuth: boolean) => {
  const authImport = hasAuth ? `import { auth } from "./auth.ts";\n` : '';

  const authHandler = hasAuth
    ? `    if (new URL(request.url).pathname.startsWith("/api/auth")) {
      return auth.handler(request);
    }\n\n`
    : '';

  return `import { RPCHandler } from "@orpc/server/fetch";
import { CORSPlugin, RequestHeadersPlugin } from "@orpc/server/plugins";
import { onError } from "@orpc/server";
${authImport}
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

Bun.serve({
  port: ${port},
  async fetch(request: Request) {
${authHandler}    const { matched, response } = await handler.handle(request, {
      prefix: "/rpc",
      context: {},
    });

    if (matched) {
      return response;
    }

    return new Response("Not found", { status: 404 });
  },
});
`;
};
