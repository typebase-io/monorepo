import fs from 'node:fs/promises';
import path from 'node:path';

import { IndentationText, type ObjectLiteralExpression, Project, SyntaxKind } from 'ts-morph';
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
    const specifier = decl.getModuleSpecifierValue();

    if (specifier === '@typebase-io/typebase/server/auth-plugins' || specifier === 'typebase-io/server/auth-plugins') {
      decl.setModuleSpecifier('better-auth/plugins');
    } else if (specifier.startsWith('@typebase-io/typebase') || specifier.startsWith('typebase-io')) {
      decl.remove();
    }
  }

  let transformed = false;

  for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (callExpr.getExpression().getText() !== 'defineAuth') {
      continue;
    }

    const arg = callExpr.getArguments()[0];
    let optionsObject: ObjectLiteralExpression | undefined;

    if (arg?.isKind(SyntaxKind.ObjectLiteralExpression)) {
      optionsObject = arg;
    } else if (arg?.isKind(SyntaxKind.Identifier)) {
      const initializer = sourceFile.getVariableDeclaration(arg.getText())?.getInitializer();

      if (initializer?.isKind(SyntaxKind.ObjectLiteralExpression)) {
        optionsObject = initializer;
      }
    }

    if (!optionsObject) {
      throw new Error(
        `Could not generate the server auth file from \`${authFilePath}\`: \`defineAuth\` must be called with an inline object literal or a local variable initialized with one.`
      );
    }

    optionsObject.insertPropertyAssignment(0, {
      name: 'database',
      initializer: `drizzleAdapter(db, { provider: "pg", usePlural: true, schema })`,
    });

    if (!optionsObject.getProperty('baseURL') && allowedHosts) {
      optionsObject.insertPropertyAssignment(1, {
        name: 'baseURL',
        initializer: `{ allowedHosts: [${allowedHosts.map((host) => JSON.stringify(host)).join(', ')}] }`,
      });
    }

    callExpr.getExpression().replaceWithText('betterAuth');

    transformed = true;

    break;
  }

  if (transformed) {
    const ext = useTs ? 'ts' : 'js';

    sourceFile.insertStatements(
      0,
      `import { betterAuth } from "better-auth";\nimport { drizzleAdapter } from "better-auth/adapters/drizzle";\nimport { db } from "./db/index.${ext}";\nimport * as schema from "./db/schema.${ext}";\n\n`
    );
  }

  sourceFile.formatText({ insertSpaceAfterCommaDelimiter: true });

  await fs.mkdir(authOutputDirPath, { recursive: true });
  await fs.writeFile(path.join(authOutputDirPath, 'auth.ts'), sourceFile.getFullText());

  await fixImportExtensions(authOutputDirPath, useTs ? 'ts' : 'js');
};
