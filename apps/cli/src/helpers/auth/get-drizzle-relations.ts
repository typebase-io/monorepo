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
    for (const decl of stmt.getDeclarations()) {
      const init = decl.getInitializer();

      if (!init?.isKind(SyntaxKind.CallExpression)) {
        continue;
      }

      if (init.getExpression().getText() !== 'relations') {
        continue;
      }

      const [sourceTableArg, callbackArg] = init.getArguments();

      if (!sourceTableArg || !callbackArg?.isKind(SyntaxKind.ArrowFunction)) {
        continue;
      }

      const sourceTable = sourceTableArg.getText();
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
        const initializer = prop.getInitializerOrThrow();

        if (!initializer.isKind(SyntaxKind.CallExpression)) {
          continue;
        }

        const call = initializer;
        const fnName = call.getExpression().getText();
        const targetTableArg = call.getArguments()[0];

        if (!targetTableArg) {
          continue;
        }

        const targetTable = targetTableArg.getText();

        if (fnName === 'many') {
          manyRelations.push({ sourceTable, relationName, targetTable });
        } else if (fnName === 'one') {
          const configArg = call.getArguments()[1];

          if (configArg?.isKind(SyntaxKind.ObjectLiteralExpression)) {
            const fieldsProp = configArg.getProperty('fields');
            const refsProp = configArg.getProperty('references');

            if (fieldsProp?.isKind(SyntaxKind.PropertyAssignment) && refsProp?.isKind(SyntaxKind.PropertyAssignment)) {
              const fieldText = fieldsProp.getInitializerOrThrow().getText();
              const field = fieldText.replace(/^\[.*\./, '').replace(/\]$/, '');

              const refText = refsProp.getInitializerOrThrow().getText();
              const reference = refText.replace(/^\[.*\./, '').replace(/\]$/, '');

              oneRelations.push({ sourceTable, relationName, targetTable, field, reference });
            }
          }
        }
      }
    }
  }

  return { oneRelations, manyRelations };
};
