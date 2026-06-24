export const fastifyIndexFileTemplate = (routerCode: string, port: number, hasAuth: boolean, trustedOrigins: string[]) => {
  const authImports = hasAuth
    ? `import cors from "@fastify/cors";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.ts";
`
    : '';

  const authCors =
    hasAuth && trustedOrigins.length > 0
      ? `fastify.register(cors, {
  origin: [${trustedOrigins.map((origin) => JSON.stringify(origin)).join(', ')}],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});`
      : '';

  const authRoute = hasAuth
    ? `fastify.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  async handler(request, reply) {
    const url = new URL(request.url, \`http://\${request.headers.host}\`);
    const headers = fromNodeHeaders(request.headers);

    const req = new Request(url.toString(), {
      method: request.method,
      headers,
      ...(request.body ? { body: JSON.stringify(request.body) } : {}),
    });

    const response = await auth.handler(req);

    reply.status(response.status);
    response.headers.forEach((value, key) => reply.header(key, value));

    reply.send(response.body ? await response.text() : null);
  },
});`
    : '';

  const authBlocks = [authCors, authRoute].filter(Boolean).join('\n\n');
  const authBlocksSection = authBlocks ? `${authBlocks}\n\n` : '';

  return `import Fastify from "fastify";
import { RPCHandler } from "@orpc/server/fastify";
import { CORSPlugin, RequestHeadersPlugin } from "@orpc/server/plugins";
import { onError } from "@orpc/server";
${authImports}
${routerCode}

const rpcHandler = new RPCHandler(router, {
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

const fastify = Fastify();

fastify.addContentTypeParser("*", (_request, _payload, done) => {
  done(null, undefined);
});

${authBlocksSection}fastify.all("/rpc/*", async (req, reply) => {
  const { matched } = await rpcHandler.handle(req, reply, {
    prefix: "/rpc",
  });

  if (!matched) {
    reply.status(404).send("Not found");
  }
});

fastify
  .listen({ port: ${port} })
  .then(() => console.log("Listening on 127.0.0.1:${port}"));
`;
};
