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

  const schemaProject = new Project({ skipAddingFilesFromTsConfig: true });
  const schemaSourceFile = schemaProject.addSourceFileAtPath(schemaFilePath);

  const relationsProject = new Project({ skipAddingFilesFromTsConfig: true });
  const relationsSourceFile = relationsProject.addSourceFileAtPath(relationsFilePath);

  const relationsArrow = relationsSourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((callExpr) => callExpr.getExpression().getText() === 'q.defineRelations')
    ?.getArguments()[1]
    ?.asKind(SyntaxKind.ArrowFunction);

  const callbackBody = relationsArrow?.getBody();
  const relationsCallback = callbackBody?.asKind(SyntaxKind.ParenthesizedExpression)?.getExpression() ?? callbackBody;
  const relationsObject = relationsCallback?.asKind(SyntaxKind.ObjectLiteralExpression);

  if (!relationsArrow || !relationsObject) {
    throw new Error(
      `Could not register the auth tables in \`${relationsFilePath}\`: expected a \`q.defineRelations(schema, (r) => ({ ... }))\` call with an inline arrow function returning an object literal. No files were modified.`
    );
  }

  const helpersParameter = relationsArrow.getParameters()[0];

  if (helpersParameter && !helpersParameter.getNameNode().isKind(SyntaxKind.Identifier)) {
    throw new Error(
      `Could not register the auth tables in \`${relationsFilePath}\`: the \`q.defineRelations\` callback destructures its parameter, so the auth relations have no name to reach the helpers through. Name it instead, as in \`(r) => ({ ... })\`. No files were modified.`
    );
  }

  const helpersName = helpersParameter?.getName() ?? 'r';

  const { cleaned, tableNames, relations } = parseGeneratedSchema(result.code.replaceAll('/* @__PURE__ */ ', ''), helpersName);

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

  const authSet = new Set(tableNames);
  const existingEntries = new Map<string, string>();

  for (const prop of relationsObject.getProperties()) {
    if (prop.isKind(SyntaxKind.PropertyAssignment)) {
      const name = prop.getName();

      if (!authSet.has(name)) {
        existingEntries.set(name, prop.getInitializerOrThrow().getText());
      }
    }
  }

  const allEntries = new Map([...existingEntries, ...relations]);

  const inner = [...allEntries.entries()].map(([name, value]) => `  ${name}: ${value},`).join('\n');

  relationsObject.replaceWithText(`{\n${inner}\n}`);

  if (!helpersParameter) {
    relationsArrow.addParameter({ name: helpersName });
  }

  schemaSourceFile.saveSync();
  relationsSourceFile.saveSync();
};
