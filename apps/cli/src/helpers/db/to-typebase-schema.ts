import { Project, SyntaxKind } from 'ts-morph';

import { formatPulledSource } from '#helpers/db/format-pulled-source.ts';
import { rewriteDrizzleImports } from '#helpers/db/rewrite-drizzle-imports.ts';
import { simplifyPulledSchema } from '#helpers/db/simplify-pulled-schema.ts';

export const toTypebaseSchema = (source: string): { source: string; tableNames: string[] } => {
  const schema = formatPulledSource(simplifyPulledSchema(rewriteDrizzleImports(source)));

  const project = new Project({ skipAddingFilesFromTsConfig: true, useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile('schema.ts', schema);
  const tableNames: string[] = [];

  for (const statement of sourceFile.getVariableStatements()) {
    for (const declaration of statement.getDeclarations()) {
      const initializer = declaration.getInitializer();

      if (initializer?.isKind(SyntaxKind.CallExpression) && initializer.getExpression().getText() === 'p.pgTable') {
        tableNames.push(declaration.getName());
      }
    }
  }

  return { source: schema, tableNames };
};
