import { type ServerFeatures } from '#helpers/templates/server.ts';

export const serverTypesTemplate = (features: ServerFeatures, routerImports: string, router: string) => {
  const imports = [
    features.db
      ? `import type { ActionBuilder, GetDBBuilder } from "typebase-io/internal";`
      : `import type { ActionBuilder } from "typebase-io/internal";`,
    `import type { InferRouterInputs, InferRouterOutputs } from "typebase-io/server";`,
    features.auth ? 'import type { auth as authConfig } from "../auth.ts";' : '',
    features.env ? 'import type { env as envSchema } from "../env.ts";' : '',
    features.publisher ? 'import type { publisher as publisherConfig } from "../publisher.ts";' : '',
    features.storage ? 'import type { storage as storageConfig } from "../storage.ts";' : '',
    features.db ? 'import type { relations } from "../db/relations.ts";' : '',
  ]
    .filter(Boolean)
    .join('\n');

  const actionType = (() => {
    const dBPart = features.db ? 'typeof relations' : 'never';
    const authPart = features.auth ? 'typeof authConfig' : 'never';
    const envPart = features.env ? 'typeof envSchema' : 'never';
    const publisherPart = features.publisher ? 'typeof publisherConfig' : 'never';
    const storagePart = features.storage ? ', typeof storageConfig' : '';

    return `ActionBuilder<${dBPart}, ${authPart}, ${envPart}, ${publisherPart}${storagePart}>`;
  })();

  const typeDeclarations = [
    'export type Router = typeof router;',
    'export type RouterInputs = InferRouterInputs<typeof router>;',
    'export type RouterOutputs = InferRouterOutputs<typeof router>;',
  ].join('\n');

  const constDeclarations = [
    `export declare const action: ${actionType};`,
    features.db ? 'export declare const getDB: GetDBBuilder<typeof relations>;' : '',
  ]
    .filter(Boolean)
    .join('\n');

  const blocks = ['// ⚠️ AUTO-GENERATED FILE — DO NOT EDIT', imports, routerImports, router, typeDeclarations, constDeclarations]
    .filter(Boolean)
    .join('\n\n');

  return `${blocks}\n`;
};
