import { Project, SyntaxKind } from 'ts-morph';

interface OneRelation {
  relationName: string;
  targetTable: string;
  field: string;
  reference: string;
}

export const getDrizzleRelations = (code: string) => {
  const project = new Project({ skipAddingFilesFromTsConfig: true, useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile('relations.ts', code);

  const oneRelations: (OneRelation & { sourceTable: string })[] = [];
  const manyRelations: { sourceTable: string; relationName: string; targetTable: string }[] = [];

  for (const stmt of sourceFile.getVariableStatements()) {
    const decl = stmt.getDeclarations()[0];
    const init = decl?.getInitializer();

    if (!init?.isKind(SyntaxKind.CallExpression)) {
      continue;
    }

    if (init.getExpression().getText() !== 'relations') {
      continue;
    }

    const sourceTable = init.getArguments()[0]?.getText() ?? '';
    const callbackArg = init.getArguments()[1];

    if (!callbackArg?.isKind(SyntaxKind.ArrowFunction)) {
      continue;
    }

    const body = callbackArg.getBody();
    const obj = body.isKind(SyntaxKind.ParenthesizedExpression) ? body.getExpression() : body;

    if (!obj.isKind(SyntaxKind.ObjectLiteralExpression)) {
      continue;
    }

    for (const prop of obj.getProperties()) {
      if (!prop.isKind(SyntaxKind.PropertyAssignment)) {
        continue;
      }

      const relationName = prop.getName();
      const call = prop.getInitializer();

      if (!call?.isKind(SyntaxKind.CallExpression)) {
        continue;
      }

      const fnName = call.getExpression().getText();
      const targetTable = call.getArguments()[0]?.getText() ?? '';

      if (fnName === 'many') {
        manyRelations.push({ sourceTable, relationName, targetTable });
      } else if (fnName === 'one') {
        const configArg = call.getArguments()[1];

        if (configArg?.isKind(SyntaxKind.ObjectLiteralExpression)) {
          const fieldsProp = configArg.getProperty('fields');
          const refsProp = configArg.getProperty('references');

          if (fieldsProp?.isKind(SyntaxKind.PropertyAssignment) && refsProp?.isKind(SyntaxKind.PropertyAssignment)) {
            const fieldText = fieldsProp.getInitializer()?.getText() ?? '';
            const field = fieldText.replace(/^\[.*\./, '').replace(/\]$/, '');

            const refText = refsProp.getInitializer()?.getText() ?? '';
            const reference = refText.replace(/^\[.*\./, '').replace(/\]$/, '');

            oneRelations.push({ sourceTable, relationName, targetTable, field, reference });
          }
        }
      }
    }
  }

  return { oneRelations, manyRelations };
};
