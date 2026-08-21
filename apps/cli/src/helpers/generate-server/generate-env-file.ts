import fs from 'node:fs/promises';
import path from 'node:path';

import { IndentationText, Project, SyntaxKind } from 'ts-morph';

import { type EnvTarget, type ServerAdapter } from '#helpers/constants.ts';
import { findDefineCalls } from '#helpers/shared/find-define-calls.ts';
import { fixImportExtensions } from '#helpers/shared/fix-import-extensions.ts';
import { hasEnv } from '#helpers/shared/has-env.ts';
import { resolveDefineOptions } from '#helpers/shared/resolve-define-options.ts';
import { envFileTemplate } from '#helpers/templates/env-file.ts';

export const generateEnvFile = async ({
  envFilePath,
  envOutputDirPath,
  adapter,
  hasDB,
  hasAuth,
  useTs,
  target,
}: {
  envFilePath: string;
  envOutputDirPath: string;
  adapter: ServerAdapter;
  hasDB: boolean;
  hasAuth: boolean;
  useTs: boolean;
  target: EnvTarget | undefined;
}) => {
  await fs.mkdir(envOutputDirPath, { recursive: true });

  const outputFilePath = path.join(envOutputDirPath, 'env.ts');
  const project = new Project({ skipAddingFilesFromTsConfig: true, manipulationSettings: { indentationText: IndentationText.TwoSpaces } });
  const defaultKeys = [hasDB ? 'DATABASE_URL' : '', hasAuth ? 'BETTER_AUTH_SECRET' : ''].filter(Boolean);

  const sourceFile = hasEnv(envFilePath) ? project.addSourceFileAtPath(envFilePath) : project.createSourceFile(envFilePath, 'defineEnv({});');
  const [callExpr] = findDefineCalls(sourceFile, 'defineEnv');

  if (!callExpr) {
    throw new Error(`Could not generate the server env file from \`${envFilePath}\`: no \`defineEnv\` call was found.`);
  }

  const schemaObject = resolveDefineOptions(callExpr);

  if (!schemaObject) {
    throw new Error(
      `Could not generate the server env file from \`${envFilePath}\`: \`defineEnv\` must be called with an inline object literal or a local variable initialized with one.`
    );
  }

  const hasCustomKeys = schemaObject.getProperties().length > 0;

  defaultKeys
    .filter((key) => !schemaObject.getProperty(key))
    .forEach((key, index) => {
      schemaObject.insertPropertyAssignment(index, {
        name: key,
        initializer: `{
  "~standard": {
    version: 1,
    vendor: "typebase",
    validate: (value) => (typeof value === "string" && value.length > 0 ? { value } : { issues: [{ message: "Required" }] }),
    types: undefined as unknown as { input: string; output: string },
  },
}`,
      });
    });

  const options = Object.fromEntries(
    (resolveDefineOptions(callExpr, 1)?.getProperties() ?? []).flatMap((property) =>
      property.isKind(SyntaxKind.PropertyAssignment) ? [[property.getName(), property.getInitializerOrThrow().getText()]] : []
    )
  );

  const imports = hasCustomKeys
    ? sourceFile
        .getImportDeclarations()
        .filter((decl) => {
          const specifier = decl.getModuleSpecifierValue();
          const isTypebaseImport = specifier.startsWith('@typebase-io/typebase') || specifier.startsWith('typebase-io');

          return !isTypebaseImport;
        })
        .map((decl) => decl.getText())
    : [];

  const template = envFileTemplate({ adapter, target, schema: schemaObject.getText(), options, imports });
  const generatedFile = project.createSourceFile(outputFilePath, template, { overwrite: true });

  generatedFile.formatText({ insertSpaceAfterCommaDelimiter: true });

  await fs.writeFile(outputFilePath, generatedFile.getFullText());
  await fixImportExtensions(envOutputDirPath, useTs ? 'ts' : 'js');
};
