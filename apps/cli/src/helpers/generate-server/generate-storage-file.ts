import fs from 'node:fs/promises';
import path from 'node:path';

import { IndentationText, Project } from 'ts-morph';

import { type LocalStorageRoute, type StorageProvider } from '#helpers/constants.ts';
import { findDefineCalls } from '#helpers/shared/find-define-calls.ts';
import { fixImportExtensions } from '#helpers/shared/fix-import-extensions.ts';
import { resolveDefineOptions } from '#helpers/shared/resolve-define-options.ts';
import { getDeclaredStorage } from '#helpers/storage/get-declared-storage.ts';
import { storageFileTemplate } from '#helpers/templates/storage-file.ts';

export const generateStorageFile = async ({
  storageFilePath,
  storageOutputDirPath,
  provider,
  useTs,
  localStorage,
}: {
  storageFilePath: string;
  storageOutputDirPath: string;
  provider: StorageProvider;
  useTs: boolean;
  localStorage?: Pick<LocalStorageRoute, 'root' | 'url'>;
}) => {
  await fs.mkdir(storageOutputDirPath, { recursive: true });

  const outputFilePath = path.join(storageOutputDirPath, 'storage.ts');
  const project = new Project({ skipAddingFilesFromTsConfig: true, manipulationSettings: { indentationText: IndentationText.TwoSpaces } });
  const sourceFile = project.addSourceFileAtPath(storageFilePath);
  const [callExpr] = findDefineCalls(sourceFile, 'defineStorage');

  if (!callExpr) {
    throw new Error(`Could not generate the server storage file from \`${storageFilePath}\`: no \`defineStorage\` call was found.`);
  }

  const config = resolveDefineOptions(callExpr);

  if (!config) {
    throw new Error(
      `Could not generate the server storage file from \`${storageFilePath}\`: \`defineStorage\` must be called with an inline object literal or a local variable initialized with one.`
    );
  }

  if (!config.getProperty('buckets')) {
    throw new Error(`Could not generate the server storage file from \`${storageFilePath}\`: \`defineStorage\` needs a \`buckets\` object.`);
  }

  const imports = sourceFile
    .getImportDeclarations()
    .filter((declaration) => !declaration.getModuleSpecifierValue().startsWith('typebase-io'))
    .map((declaration) => declaration.getText());

  const publicBuckets =
    provider === 'cloudflare' && localStorage === undefined
      ? getDeclaredStorage(storageFilePath)
          .buckets.filter(({ access }) => access === 'public')
          .map(({ bucket }) => bucket)
      : [];

  const template = storageFileTemplate({ config: config.getText(), imports, provider, localStorage, publicBuckets, ts: useTs });
  const generatedFile = project.createSourceFile(outputFilePath, template, { overwrite: true });

  generatedFile.formatText({ insertSpaceAfterCommaDelimiter: true });

  await fs.writeFile(outputFilePath, generatedFile.getFullText());
  await fixImportExtensions(storageOutputDirPath, useTs ? 'ts' : 'js');
};
