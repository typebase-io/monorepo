import fs from 'node:fs/promises';
import path from 'node:path';

import { IndentationText, Project, SyntaxKind } from 'ts-morph';
import { match } from 'ts-pattern';

import { type ServerProvider } from '#helpers/constants.ts';
import { fixImportExtensions } from '#helpers/shared/fix-import-extensions.ts';

export const generateAuthFile = async ({
  authFilePath,
  authOutputDirPath,
  useTs,
  provider,
}: {
  authFilePath: string;
  authOutputDirPath: string;
  useTs: boolean;
  provider: ServerProvider | undefined;
}) => {
  const project = new Project({ skipAddingFilesFromTsConfig: true, manipulationSettings: { indentationText: IndentationText.TwoSpaces } });
  const sourceFile = project.addSourceFileAtPath(authFilePath);

  const allowedHosts = match(provider)
    .with('vercel', () => ['*.vercel.app'])
    .with('deno', () => ['*.deno.dev', '*.deno.net'])
    .with('cloudflare', () => ['*.workers.dev'])
    .with(undefined, () => undefined)
    .exhaustive();

  for (const decl of sourceFile.getImportDeclarations()) {
    if (decl.getModuleSpecifierValue().startsWith('@typebase-io/typebase') || decl.getModuleSpecifierValue().startsWith('typebase-io')) {
      decl.remove();
    }
  }

  sourceFile.insertStatements(0, [
    `import { betterAuth } from "better-auth";`,
    `import { drizzleAdapter } from "better-auth/adapters/drizzle";`,
    `import { db } from "./db/index.ts";`,
    `import * as schema from "./db/schema.ts";\n\n`,
  ]);

  for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (callExpr.getExpression().getText() !== 'defineAuth') {
      continue;
    }

    const optionsArg = callExpr.getArguments()[0];

    if (!optionsArg?.isKind(SyntaxKind.ObjectLiteralExpression)) {
      continue;
    }

    optionsArg.insertPropertyAssignment(0, {
      name: 'database',
      initializer: `drizzleAdapter(db, { provider: "pg", usePlural: true, schema })`,
    });

    if (!optionsArg.getProperty('baseURL') && allowedHosts) {
      optionsArg.insertPropertyAssignment(1, {
        name: 'baseURL',
        initializer: `{ allowedHosts: ${JSON.stringify(allowedHosts)} }`,
      });
    }

    callExpr.getExpression().replaceWithText('betterAuth');

    break;
  }

  await fs.mkdir(authOutputDirPath, { recursive: true });
  await fs.writeFile(path.join(authOutputDirPath, 'auth.ts'), sourceFile.getFullText());

  await fixImportExtensions(authOutputDirPath, useTs ? 'ts' : 'js');
};
