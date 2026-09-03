import fs from 'node:fs/promises';
import path from 'node:path';

import { IndentationText, Project } from 'ts-morph';
import { P, match } from 'ts-pattern';

import { type ServerProvider } from '#helpers/constants.ts';
import { findDefineCalls } from '#helpers/shared/find-define-calls.ts';
import { fixImportExtensions } from '#helpers/shared/fix-import-extensions.ts';
import { resolveDefineOptions } from '#helpers/shared/resolve-define-options.ts';

export const generateAuthFile = async ({
  authFilePath,
  authOutputDirPath,
  useTs,
  baseURL,
}: {
  authFilePath: string;
  authOutputDirPath: string;
  useTs: boolean;
  baseURL: { provider: ServerProvider } | { url: string } | undefined;
}) => {
  const project = new Project({ skipAddingFilesFromTsConfig: true, manipulationSettings: { indentationText: IndentationText.TwoSpaces } });
  const sourceFile = project.addSourceFileAtPath(authFilePath);
  const hostList = (hosts: string[]) => `{ allowedHosts: [${hosts.map((host) => JSON.stringify(host)).join(', ')}] }`;

  const baseURLInitializer = match(baseURL)
    .with({ url: P.string }, ({ url }) => JSON.stringify(url))
    .with({ provider: 'vercel' }, () => hostList(['*.vercel.app']))
    .with({ provider: 'deno' }, () => hostList(['*.deno.dev', '*.deno.net']))
    .with({ provider: 'cloudflare' }, () => hostList(['*.workers.dev']))
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

  for (const callExpr of findDefineCalls(sourceFile, 'defineAuth')) {
    const optionsObject = resolveDefineOptions(callExpr);

    if (!optionsObject) {
      throw new Error(
        `Could not generate the server auth file from \`${authFilePath}\`: \`defineAuth\` must be called with an inline object literal or a local variable initialized with one.`
      );
    }

    optionsObject.insertPropertyAssignment(0, {
      name: 'database',
      initializer: `drizzleAdapter(db, { provider: "pg", usePlural: true, schema })`,
    });

    if (!optionsObject.getProperty('baseURL') && baseURLInitializer) {
      optionsObject.insertPropertyAssignment(1, { name: 'baseURL', initializer: baseURLInitializer });
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
