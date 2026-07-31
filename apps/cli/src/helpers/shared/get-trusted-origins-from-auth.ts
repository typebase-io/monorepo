import chalk from 'chalk';
import { Project, SyntaxKind } from 'ts-morph';

import { findDefineCalls } from '#helpers/shared/find-define-calls.ts';
import { resolveDefineOptions } from '#helpers/shared/resolve-define-options.ts';

export const getTrustedOriginsFromAuth = (authFilePath: string): string[] => {
  const project = new Project({ skipAddingFilesFromTsConfig: true, skipLoadingLibFiles: true });
  const sourceFile = project.addSourceFileAtPath(authFilePath);

  for (const callExpr of findDefineCalls(sourceFile, 'defineAuth')) {
    const optionsObject = resolveDefineOptions(callExpr);

    if (!optionsObject) {
      continue;
    }

    const prop = optionsObject.getProperty('trustedOrigins');

    if (!prop) {
      continue;
    }

    if (!prop.isKind(SyntaxKind.PropertyAssignment)) {
      warnUnreadableTrustedOrigins(prop.getText());

      continue;
    }

    const initializer = prop.getInitializer();

    if (!initializer?.isKind(SyntaxKind.ArrayLiteralExpression)) {
      warnUnreadableTrustedOrigins(initializer?.getText());

      continue;
    }

    return initializer.getElements().flatMap((el) => {
      if (el.isKind(SyntaxKind.StringLiteral) || el.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
        return [el.getLiteralText()];
      }

      warnUnreadableTrustedOrigins(el.getText());

      return [];
    });
  }

  return [];
};

const warnUnreadableTrustedOrigins = (text = '') => {
  console.warn(
    chalk.yellow(
      `Could not statically read \`trustedOrigins\` entry \`${text}\` from auth.ts; it will be omitted from the generated server's auth CORS allowlist.`
    )
  );
};
