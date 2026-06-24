import { generateDrizzleSchema } from 'auth/api';
import { Project, SyntaxKind } from 'ts-morph';

import { createMockAdapter } from '#helpers/auth/create-mock-adapter.ts';
import { extractDefineAuthOptions } from '#helpers/auth/extract-define-auth-options.ts';
import { parseGeneratedSchema } from '#helpers/auth/parse-generated-schema.ts';

export const generateAuthSchema = async ({
  schemaFilePath,
  relationsFilePath,
  authFilePath,
}: {
  schemaFilePath: string;
  relationsFilePath: string;
  authFilePath: string;
}) => {
  const config = await extractDefineAuthOptions(authFilePath);

  const result = await generateDrizzleSchema({
    options: {
      ...config,
      logger: {
        level: 'error',
      },
    },
    adapter: createMockAdapter(),
  });

  if (result.code === undefined) {
    throw new Error('Better Auth did not return generated schema code.');
  }

  const { cleaned, tableNames, relations } = parseGeneratedSchema(result.code.replaceAll('/* @__PURE__ */ ', ''));

  const schemaProjet = new Project({ skipAddingFilesFromTsConfig: true });
  const schemaSourceFile = schemaProjet.addSourceFileAtPath(schemaFilePath);

  for (const name of tableNames) {
    for (const stmt of schemaSourceFile.getVariableStatements()) {
      const decl = stmt.getDeclarations().find((decl) => decl.getName() === name);

      if (decl) {
        if (stmt.getDeclarations().length === 1) {
          stmt.remove();
        } else {
          decl.remove();
        }

        break;
      }
    }
  }

  schemaSourceFile.replaceWithText(`${schemaSourceFile.getFullText().trimEnd()}\n\n${cleaned}\n`);
  schemaSourceFile.saveSync();

  const relationsProject = new Project({ skipAddingFilesFromTsConfig: true });
  const relationsSourceFile = relationsProject.addSourceFileAtPath(relationsFilePath);

  for (const callExpr of relationsSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (callExpr.getExpression().getText() !== 'q.defineRelations') {
      continue;
    }

    const callbackArg = callExpr.getArguments()[1];

    if (!callbackArg?.isKind(SyntaxKind.ArrowFunction)) {
      continue;
    }

    const body = callbackArg.getBody();
    const obj = body.isKind(SyntaxKind.ParenthesizedExpression) ? body.getExpression() : body;

    if (!obj.isKind(SyntaxKind.ObjectLiteralExpression)) {
      continue;
    }

    const authSet = new Set(tableNames);
    const existingEntries = new Map<string, string>();

    for (const prop of obj.getProperties()) {
      if (prop.isKind(SyntaxKind.PropertyAssignment)) {
        const name = prop.getName();

        if (!authSet.has(name)) {
          existingEntries.set(name, prop.getInitializerOrThrow().getText());
        }
      }
    }

    const allEntries = new Map([...existingEntries, ...relations]);

    const inner = [...allEntries.entries()].map(([name, value]) => `  ${name}: ${value},`).join('\n');

    obj.replaceWithText(`{\n${inner}\n}`);

    break;
  }

  relationsSourceFile.saveSync();
};
