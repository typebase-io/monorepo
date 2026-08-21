import fs from 'node:fs/promises';
import path from 'node:path';

import { IndentationText, Project } from 'ts-morph';

import { type PublisherProvider } from '#helpers/constants.ts';
import { findDefineCalls } from '#helpers/shared/find-define-calls.ts';
import { fixImportExtensions } from '#helpers/shared/fix-import-extensions.ts';
import { resolveDefineOptions } from '#helpers/shared/resolve-define-options.ts';
import { publisherFileTemplate } from '#helpers/templates/publisher-file.ts';

export const generatePublisherFile = async ({
  publisherFilePath,
  publisherOutputDirPath,
  provider,
  useTs,
}: {
  publisherFilePath: string;
  publisherOutputDirPath: string;
  provider: PublisherProvider;
  useTs: boolean;
}) => {
  await fs.mkdir(publisherOutputDirPath, { recursive: true });

  const outputFilePath = path.join(publisherOutputDirPath, 'publisher.ts');
  const project = new Project({ skipAddingFilesFromTsConfig: true, manipulationSettings: { indentationText: IndentationText.TwoSpaces } });
  const sourceFile = project.addSourceFileAtPath(publisherFilePath);
  const [callExpr] = findDefineCalls(sourceFile, 'definePublisher');

  if (!callExpr) {
    throw new Error(`Could not generate the server publisher file from \`${publisherFilePath}\`: no \`definePublisher\` call was found.`);
  }

  const config = resolveDefineOptions(callExpr);

  if (!config) {
    throw new Error(
      `Could not generate the server publisher file from \`${publisherFilePath}\`: \`definePublisher\` must be called with an inline object literal or a local variable initialized with one.`
    );
  }

  const events = config.getProperty('events');

  if (!events) {
    throw new Error(`Could not generate the server publisher file from \`${publisherFilePath}\`: \`definePublisher\` needs an \`events\` object.`);
  }

  const imports = sourceFile
    .getImportDeclarations()
    .filter((declaration) => !declaration.getModuleSpecifierValue().startsWith('typebase-io'))
    .map((declaration) => declaration.getText());

  const template = publisherFileTemplate({ config: config.getText(), imports, provider, ts: useTs });
  const generatedFile = project.createSourceFile(outputFilePath, template, { overwrite: true });

  generatedFile.formatText({ insertSpaceAfterCommaDelimiter: true });

  await fs.writeFile(outputFilePath, generatedFile.getFullText());
  await fixImportExtensions(publisherOutputDirPath, useTs ? 'ts' : 'js');
};
