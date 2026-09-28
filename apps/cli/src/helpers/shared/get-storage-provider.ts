import { existsSync } from 'node:fs';

import { Project, SyntaxKind } from 'ts-morph';

import { type StorageProvider, storageProviders } from '#helpers/constants.ts';
import { findDefineCalls } from '#helpers/shared/find-define-calls.ts';
import { resolveDefineOptions } from '#helpers/shared/resolve-define-options.ts';

export const getStorageProvider = (storageFilePath: string): StorageProvider | undefined => {
  if (!existsSync(storageFilePath)) {
    return undefined;
  }

  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const sourceFile = project.addSourceFileAtPath(storageFilePath);
  const [callExpr] = findDefineCalls(sourceFile, 'defineStorage');

  if (!callExpr) {
    throw new Error('`storage.ts` does not call `defineStorage`. Export a storage config from it, or delete the file.');
  }

  const provider = resolveDefineOptions(callExpr)
    ?.getProperty('provider')
    ?.asKind(SyntaxKind.PropertyAssignment)
    ?.getInitializer()
    ?.asKind(SyntaxKind.StringLiteral)
    ?.getLiteralValue();

  if (!provider) {
    throw new Error(
      `Could not read which storage provider \`storage.ts\` asks for. \`defineStorage\` needs a \`provider\` written as a plain string, one of: ${storageProviders.join(', ')}.`
    );
  }

  if (!storageProviders.includes(provider as StorageProvider)) {
    throw new Error(
      `\`storage.ts\` asks for the \`${provider}\` storage provider, which Typebase does not have. Pick one of: ${storageProviders.join(', ')}.`
    );
  }

  return provider as StorageProvider;
};
