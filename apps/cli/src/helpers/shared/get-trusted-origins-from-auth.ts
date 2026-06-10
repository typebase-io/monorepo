import chalk from 'chalk';
import { Project, SyntaxKind } from 'ts-morph';

export const getTrustedOriginsFromAuth = (authFilePath: string): string[] => {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const sourceFile = project.addSourceFileAtPath(authFilePath);

  for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (callExpr.getExpression().getText() !== 'defineAuth') {
      continue;
    }

    const optionsArg = callExpr.getArguments()[0];

    if (!optionsArg?.isKind(SyntaxKind.ObjectLiteralExpression)) {
      continue;
    }

    const prop = optionsArg.getProperty('trustedOrigins');

    if (!prop) {
      continue;
    }

    if (!prop.isKind(SyntaxKind.PropertyAssignment)) {
      warnUnreadableTrustedOrigins(prop.getText());

      continue;
    }

    const initializer = prop.getInitializer();

    if (!initializer?.isKind(SyntaxKind.ArrayLiteralExpression)) {
      warnUnreadableTrustedOrigins(initializer?.getText() ?? prop.getText());

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

const warnUnreadableTrustedOrigins = (text: string) => {
  console.warn(
    chalk.yellow(
      `Could not statically read \`trustedOrigins\` entry \`${text}\` from auth.ts; it will be omitted from the generated server's auth CORS allowlist.`
    )
  );
};
