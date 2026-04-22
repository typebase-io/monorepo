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

    if (!prop?.isKind(SyntaxKind.PropertyAssignment)) {
      continue;
    }

    const initializer = prop.getInitializer();

    if (!initializer?.isKind(SyntaxKind.ArrayLiteralExpression)) {
      continue;
    }

    return initializer
      .getElements()
      .filter((el) => el.isKind(SyntaxKind.StringLiteral))
      .map((el) => el.getLiteralText());
  }

  return [];
};
