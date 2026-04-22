import { Project, SyntaxKind } from 'ts-morph';

import { buildRelation } from '#helpers/auth/build-relations.ts';
import { getDrizzleRelations } from '#helpers/auth/get-drizzle-relations.ts';

export const parseGeneratedSchema = (code: string): { cleaned: string; tableNames: string[]; relations: Map<string, string> } => {
  const project = new Project({ skipAddingFilesFromTsConfig: true, useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile('schema.ts', code);
  const tableNames: string[] = [];
  const pgCoreIdentifiers = new Set<string>();

  for (const imp of sourceFile.getImportDeclarations()) {
    if (imp.getModuleSpecifierValue() === 'drizzle-orm/pg-core') {
      for (const named of imp.getNamedImports()) {
        pgCoreIdentifiers.add(named.getName());
      }
    }

    imp.remove();
  }

  const { oneRelations, manyRelations } = getDrizzleRelations(code);
  const relations = buildRelation(oneRelations, manyRelations);

  for (const stmt of sourceFile.getVariableStatements()) {
    const decl = stmt.getDeclarations()[0];

    if (!decl) {
      continue;
    }

    const init = decl.getInitializer();

    if (!init?.isKind(SyntaxKind.CallExpression)) {
      continue;
    }

    const callee = init.getExpression().getText();

    if (callee === 'relations') {
      stmt.remove();
    } else if (callee.endsWith('Table')) {
      tableNames.push(decl.getName());
    }
  }

  for (const name of tableNames) {
    if (!relations.has(name)) {
      relations.set(name, '{}');
    }
  }

  let result = sourceFile.getFullText().trim();

  for (const id of pgCoreIdentifiers) {
    result = result.replaceAll(new RegExp(`(?<![.\\w])${id}(?=\\s*\\()`, 'g'), `p.${id}`);
  }

  return { cleaned: result, tableNames, relations };
};
