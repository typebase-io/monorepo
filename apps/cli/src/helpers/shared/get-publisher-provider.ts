import { existsSync } from 'node:fs';

import { Project, SyntaxKind } from 'ts-morph';

import { type PublisherProvider, publisherProviders } from '#helpers/constants.ts';
import { findDefineCalls } from '#helpers/shared/find-define-calls.ts';
import { resolveDefineOptions } from '#helpers/shared/resolve-define-options.ts';

export const getPublisherProvider = (publisherFilePath: string): PublisherProvider | undefined => {
  if (!existsSync(publisherFilePath)) {
    return undefined;
  }

  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const sourceFile = project.addSourceFileAtPath(publisherFilePath);
  const [callExpr] = findDefineCalls(sourceFile, 'definePublisher');

  if (!callExpr) {
    throw new Error('`publisher.ts` does not call `definePublisher`. Export a publisher from it, or delete the file.');
  }

  const provider = resolveDefineOptions(callExpr)
    ?.getProperty('provider')
    ?.asKind(SyntaxKind.PropertyAssignment)
    ?.getInitializer()
    ?.asKind(SyntaxKind.StringLiteral)
    ?.getLiteralValue();

  if (!provider) {
    throw new Error(
      `Could not read which publisher \`publisher.ts\` asks for. \`definePublisher\` needs a \`provider\` written as a plain string, one of: ${publisherProviders.join(', ')}.`
    );
  }

  if (!publisherProviders.includes(provider as PublisherProvider)) {
    throw new Error(
      `\`publisher.ts\` asks for the \`${provider}\` publisher, which Typebase does not have. Pick one of: ${publisherProviders.join(', ')}.`
    );
  }

  return provider as PublisherProvider;
};
