export const denoIndexFileTemplate = (routerCode: string, port: number, hasAuth: boolean) => {
  const authHandler = hasAuth
    ? `if (new URL(request.url).pathname.startsWith("/api/auth")) {
    return auth.handler(request);
  }`
    : '';

  return `import { RPCHandler } from "@orpc/server/fetch";
import { CORSPlugin, RequestHeadersPlugin } from "@orpc/server/plugins";
import { onError } from "@orpc/server";
${hasAuth ? `import { auth } from "./auth.ts";` : ''}

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

Deno.serve({ port: ${port} }, async (request) => {
  ${authHandler}

  const { matched, response } = await handler.handle(request, {
    prefix: "/rpc",
    context: {},
  });

  if (matched) {
    return response;
  }

  return new Response("Not found", { status: 404 });
});
`;
};
