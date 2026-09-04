import { serverPathPrefix } from '#helpers/shared/server-path-prefix.ts';
import { authPathCondition } from '#helpers/templates/server-file/auth-path-condition.ts';
import { type ServerFileOptions } from '#helpers/templates/server-file/options.ts';
import { rpcPlugins, rpcPluginsImport } from '#helpers/templates/server-file/rpc-plugins.ts';

export const bunServerFileTemplate = ({ routerCode, hasAuth, mode, actionsPath, authPath }: ServerFileOptions) => {
  const authImport = hasAuth ? `import { auth } from "./auth.ts";\n` : '';

  const authHandler = hasAuth
    ? `  const pathname = new URL(request.url).pathname;

  if (${authPathCondition(authPath)}) {
    return auth.handler(request);
  }\n\n`
    : '';

  return `import { RPCHandler } from "@orpc/server/fetch";
${rpcPluginsImport(mode)}
import { onError } from "@orpc/server";
${authImport}
${routerCode}

const handler = new RPCHandler(router, {
${rpcPlugins(mode)}
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

export const typebaseHandler = async (request: Request): Promise<Response> => {
${authHandler}  const { matched, response } = await handler.handle(request, {
    prefix: ${JSON.stringify(serverPathPrefix(actionsPath))},
    context: {},
  });

  if (matched) {
    return response;
  }

  return new Response("Not found", { status: 404 });
};
${hasAuth ? '\nexport { auth };\n' : ''}`;
};
