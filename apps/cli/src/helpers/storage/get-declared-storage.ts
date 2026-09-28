import { Project, SyntaxKind } from 'ts-morph';

import { type BucketAccess, bucketAccesses } from '#helpers/constants.ts';
import { findDefineCalls } from '#helpers/shared/find-define-calls.ts';
import { readStringProperty } from '#helpers/shared/read-string-property.ts';
import { resolveDefineOptions } from '#helpers/shared/resolve-define-options.ts';

export const getDeclaredStorage = (
  storageFilePath: string
): { buckets: { bucket: string; access: BucketAccess }[]; region: string | undefined; locationHint: string | undefined } => {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const sourceFile = project.addSourceFileAtPath(storageFilePath);
  const [callExpr] = findDefineCalls(sourceFile, 'defineStorage');
  const config = callExpr ? resolveDefineOptions(callExpr) : undefined;

  if (!config) {
    throw new Error('`storage.ts` must call `defineStorage` with an inline object literal or a local variable initialized with one.');
  }

  const bucketsObject = config
    .getProperty('buckets')
    ?.asKind(SyntaxKind.PropertyAssignment)
    ?.getInitializer()
    ?.asKind(SyntaxKind.ObjectLiteralExpression);

  if (!bucketsObject) {
    throw new Error('`defineStorage` in `storage.ts` needs a `buckets` object written inline, so bucket sync can read the declared buckets.');
  }

  const buckets = bucketsObject.getProperties().map((property) => {
    const assignment = property.asKind(SyntaxKind.PropertyAssignment);
    const bucketOptions = assignment?.getInitializer()?.asKind(SyntaxKind.ObjectLiteralExpression);

    if (!assignment || !bucketOptions) {
      throw new Error(`Could not read the bucket \`${property.getText()}\` in \`storage.ts\`. Declare every bucket as \`name: { ... }\`.`);
    }

    const bucket = assignment.getNameNode().asKind(SyntaxKind.StringLiteral)?.getLiteralValue() ?? assignment.getName();
    const access = readStringProperty(bucketOptions, 'access', 'storage.ts');

    if (access === undefined) {
      throw new Error(`The bucket \`${bucket}\` in \`storage.ts\` has no access. Declare it \`access: 'public'\` or \`access: 'private'\`.`);
    }

    if (!bucketAccesses.includes(access as BucketAccess)) {
      throw new Error(`The bucket \`${bucket}\` in \`storage.ts\` has the access \`${access}\`. Use one of: ${bucketAccesses.join(', ')}.`);
    }

    return { bucket, access: access as BucketAccess };
  });

  const options = config.getProperty('options')?.asKind(SyntaxKind.PropertyAssignment)?.getInitializer()?.asKind(SyntaxKind.ObjectLiteralExpression);

  return {
    buckets,
    region: options ? readStringProperty(options, 'region', 'storage.ts') : undefined,
    locationHint: options ? readStringProperty(options, 'locationHint', 'storage.ts') : undefined,
  };
};
