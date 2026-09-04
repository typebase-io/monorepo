import { Project, SyntaxKind } from 'ts-morph';

import { DEFAULT_AUTH_PATH } from '#helpers/constants.ts';
import { findDefineCalls } from '#helpers/shared/find-define-calls.ts';
import { getAuthBasePathProperty } from '#helpers/shared/get-auth-base-path-property.ts';
import { hasDynamicAuthOptions } from '#helpers/shared/has-dynamic-auth-options.ts';
import { resolveDefineOptions } from '#helpers/shared/resolve-define-options.ts';

export const getBasePathFromAuth = (authFilePath: string): string | { fromAuth: true } | undefined => {
  const project = new Project({ skipAddingFilesFromTsConfig: true, skipLoadingLibFiles: true });
  const sourceFile = project.addSourceFileAtPath(authFilePath);

  for (const callExpr of findDefineCalls(sourceFile, 'defineAuth')) {
    const options = resolveDefineOptions(callExpr);
    const prop = options ? getAuthBasePathProperty(options) : undefined;

    if (options && hasDynamicAuthOptions(options)) {
      return { fromAuth: true };
    }

    if (!prop) {
      continue;
    }

    const initializer = prop.asKind(SyntaxKind.PropertyAssignment)?.getInitializer();

    if (initializer?.isKind(SyntaxKind.StringLiteral) || initializer?.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
      return initializer.getLiteralText() || DEFAULT_AUTH_PATH;
    }

    return { fromAuth: true };
  }

  return undefined;
};
