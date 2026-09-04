import { normalizeServerPath } from '#helpers/shared/normalize-server-path.ts';
import { serverPathPrefix } from '#helpers/shared/server-path-prefix.ts';
import { authPathExpressions } from '#helpers/templates/server-file/auth-path-expressions.ts';
import { type ServerFileOptions } from '#helpers/templates/server-file/options.ts';
import { rpcPlugins, rpcPluginsImport } from '#helpers/templates/server-file/rpc-plugins.ts';

export const fastifyServerFileTemplate = ({ routerCode, hasAuth, mode, actionsPath, authPath }: ServerFileOptions) => {
  const contentTypeParser =
    mode === 'embedded'
      ? `  fastify.addContentTypeParser("*", (_request, _payload, done) => {
    done(null, undefined);
  });`
      : '';

  const contentTypeParserSection = contentTypeParser ? `${contentTypeParser}\n\n` : '';

  const authImports = hasAuth
    ? `import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.ts";
`
    : '';

  const authRoute = hasAuth
    ? `  fastify.route({
    method: ["GET", "POST"],
    url: ${authPathExpressions(authPath).wildcard},
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

  const authRouteSection = authRoute ? `${authRoute}\n\n` : '';

  return `import type { FastifyInstance } from "fastify";
import { RPCHandler } from "@orpc/server/fastify";
${rpcPluginsImport(mode)}
import { onError } from "@orpc/server";
${authImports}
${routerCode}

const rpcHandler = new RPCHandler(router, {
${rpcPlugins(mode)}
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

export const typebaseHandler = async (fastify: FastifyInstance) => {
${contentTypeParserSection}${authRouteSection}  fastify.all(${JSON.stringify(`${normalizeServerPath(actionsPath)}/*`)}, async (req, reply) => {
    const { matched } = await rpcHandler.handle(req, reply, {
      prefix: ${JSON.stringify(serverPathPrefix(actionsPath))},
    });

    if (!matched) {
      reply.status(404).send("Not found");
    }
  });
};
${hasAuth ? '\nexport { auth };\n' : ''}`;
};
