export const serverTypesTemplate = (hasDB: boolean, hasAuth: boolean, routerImports: string, router: string) => {
  const imports = [
    hasDB ? `import type { ActionBuilder, GetDBBuilder } from "typebase-io/server";` : `import type { ActionBuilder } from "typebase-io/server";`,
    hasAuth ? 'import type { auth as authConfig } from "../auth.ts";' : '',
    hasDB ? 'import type { relations } from "../db/relations.ts";' : '',
  ]
    .filter(Boolean)
    .join('\n');

  const actionType = (() => {
    if (hasDB && hasAuth) return 'ActionBuilder<typeof relations, typeof authConfig>';
    if (hasDB) return 'ActionBuilder<typeof relations>';
    return 'ActionBuilder';
  })();

  return `// ⚠️ AUTO-GENERATED FILE — DO NOT EDIT

${imports}

${routerImports}

${router}

export type Router = typeof router;
export declare const action: ${actionType};
${hasDB ? 'export declare const getDB: GetDBBuilder<typeof relations>;' : ''}
`;
};
