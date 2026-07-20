export const serverTemplate = (hasDB: boolean, hasAuth: boolean) => {
  const imports = [
    'import { os } from "@orpc/server";',
    'import { Action } from "typebase-io/server";',
    'import type { RequestHeadersPluginContext } from "@orpc/server/plugins";',
    hasDB ? 'import { db } from "../db/index.ts";' : '',
    hasAuth ? 'import { auth } from "../auth.ts";' : '',
  ].filter(Boolean);

  const contextEntries = [hasDB ? 'db: context.db ?? db,' : '', hasAuth ? 'auth: context.auth ?? auth,' : ''].filter(Boolean);
  const contextType = [hasDB ? 'db?: typeof db' : '', hasAuth ? 'auth?: typeof auth' : ''].filter(Boolean).join('; ');

  const lines = [...imports, ''];

  lines.push('const base = os.$context<RequestHeadersPluginContext>();');

  if (contextEntries.length === 0) {
    lines.push('', 'export const action = new Action(base);');

    return lines.join('\n');
  }

  lines.push(
    '',
    'const providerMiddleware = base',
    `  .$context<{ ${contextType} }>()`,
    '  .middleware(async ({ context, next }) => {',
    '    return next({',
    '      context: {',
    ...contextEntries.map((e) => `        ${e}`),
    '      },',
    '    });',
    '  });',
    '',
    'const withProviders = base.use(providerMiddleware);',
    '',
    'export const action = new Action(withProviders);',
    ...(hasDB ? ['', 'export const getDB = () => db;'] : [])
  );

  return lines.join('\n');
};
