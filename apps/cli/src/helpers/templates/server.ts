export interface ServerFeatures {
  db: boolean;
  auth: boolean;
  env: boolean;
  publisher: boolean;
  storage: boolean;
}

export const serverTemplate = (features: ServerFeatures) => {
  const imports = [
    'import { os } from "@orpc/server";',
    'import { Action } from "typebase-io/internal";',
    'import type { RequestHeadersPluginContext } from "@orpc/server/plugins";',
    features.db ? 'import { db } from "../db/index.ts";' : '',
    features.auth ? 'import { auth } from "../auth.ts";' : '',
    features.env ? 'import { env } from "../env.ts";' : '',
    features.publisher ? 'import { publisher } from "../publisher.ts";' : '',
    features.storage ? 'import { storage } from "../storage.ts";' : '',
  ].filter(Boolean);

  const contextEntries = [
    features.db ? 'db: context.db ?? db,' : '',
    features.auth ? 'auth: context.auth ?? auth,' : '',
    features.env ? 'env: context.env ?? env,' : '',
    features.publisher ? 'publisher: context.publisher ?? publisher,' : '',
    features.storage ? 'storage: context.storage ?? storage,' : '',
  ].filter(Boolean);

  const contextType = [
    features.db ? 'db?: typeof db' : '',
    features.auth ? 'auth?: typeof auth' : '',
    features.env ? 'env?: typeof env' : '',
    features.publisher ? 'publisher?: typeof publisher' : '',
    features.storage ? 'storage?: typeof storage' : '',
  ]
    .filter(Boolean)
    .join('; ');

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
    ...(features.db ? ['', 'export const getDB = () => db;'] : [])
  );

  return lines.join('\n');
};
