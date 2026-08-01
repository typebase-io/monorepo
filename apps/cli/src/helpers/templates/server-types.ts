export const serverTypesTemplate = (hasDB: boolean, hasAuth: boolean, hasEnv: boolean, routerImports: string, router: string) => {
  const imports = [
    hasDB
      ? `import type { ActionBuilder, GetDBBuilder, InferRouterInputs, InferRouterOutputs } from "typebase-io/server";`
      : `import type { ActionBuilder, InferRouterInputs, InferRouterOutputs } from "typebase-io/server";`,
    hasAuth ? 'import type { auth as authConfig } from "../auth.ts";' : '',
    hasEnv ? 'import type { env as envSchema } from "../env.ts";' : '',
    hasDB ? 'import type { relations } from "../db/relations.ts";' : '',
  ]
    .filter(Boolean)
    .join('\n');

  const actionType = (() => {
    const dBPart = hasDB ? 'typeof relations' : 'never';
    const authPart = hasAuth ? 'typeof authConfig' : 'never';
    const envPart = hasEnv ? 'typeof envSchema' : 'never';

    return `ActionBuilder<${dBPart}, ${authPart}, ${envPart}>`;
  })();

  const typeDeclarations = [
    'export type Router = typeof router;',
    'export type RouterInputs = InferRouterInputs<typeof router>;',
    'export type RouterOutputs = InferRouterOutputs<typeof router>;',
  ].join('\n');

  const constDeclarations = [
    `export declare const action: ${actionType};`,
    hasDB ? 'export declare const getDB: GetDBBuilder<typeof relations>;' : '',
  ]
    .filter(Boolean)
    .join('\n');

  const blocks = ['// ⚠️ AUTO-GENERATED FILE — DO NOT EDIT', imports, routerImports, router, typeDeclarations, constDeclarations]
    .filter(Boolean)
    .join('\n\n');

  return `${blocks}\n`;
};
