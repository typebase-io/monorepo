export const dbTypesTemplate = (schemaImportPath: string, hasAuth: boolean) => {
  const imports = [
    'import type { InferDB } from "typebase-io/db";',
    hasAuth ? 'import type { auth } from "../auth.ts";' : '',
    `import type * as schema from "${schemaImportPath}";`,
  ]
    .filter(Boolean)
    .join('\n');

  return `// ⚠️ AUTO-GENERATED FILE — DO NOT EDIT

${imports}

export type DB = InferDB<typeof schema>;
${hasAuth ? 'export type AuthSession = typeof auth.$Infer.Session;\n' : '\n'}`;
};
