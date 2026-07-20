import chalk from 'chalk';
import { type Node, type ObjectLiteralExpression, Project, SyntaxKind } from 'ts-morph';

const MAX_RESOLVE_DEPTH = 8;

export const getTrustedOriginsFromAuth = (authFilePath: string): string[] => {
  const project = new Project({ skipAddingFilesFromTsConfig: true, skipLoadingLibFiles: true });
  const sourceFile = project.addSourceFileAtPath(authFilePath);

  for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (callExpr.getExpression().getText() !== 'defineAuth') {
      continue;
    }

    let node: Node | undefined = callExpr.getArguments()[0];
    let optionsObject: ObjectLiteralExpression | undefined;

    for (let depth = 0; node && depth < MAX_RESOLVE_DEPTH; depth++) {
      if (node.isKind(SyntaxKind.ObjectLiteralExpression)) {
        optionsObject = node;

        break;
      }

      if (node.isKind(SyntaxKind.ParenthesizedExpression) || node.isKind(SyntaxKind.AsExpression) || node.isKind(SyntaxKind.SatisfiesExpression)) {
        node = node.getExpression();

        continue;
      }

      if (node.isKind(SyntaxKind.Identifier)) {
        const declaration = node.getSymbol()?.getValueDeclaration();

        node = declaration?.isKind(SyntaxKind.VariableDeclaration) ? declaration.getInitializer() : undefined;

        continue;
      }

      if (node.isKind(SyntaxKind.CallExpression)) {
        const callee = node.getExpression();
        const declaration = callee.isKind(SyntaxKind.Identifier) ? callee.getSymbol()?.getValueDeclaration() : undefined;

        let functionBody: Node | undefined;

        if (declaration?.isKind(SyntaxKind.FunctionDeclaration)) {
          functionBody = declaration.getBody();
        } else if (declaration?.isKind(SyntaxKind.VariableDeclaration)) {
          const initializer = declaration.getInitializer();

          if (initializer?.isKind(SyntaxKind.ArrowFunction) || initializer?.isKind(SyntaxKind.FunctionExpression)) {
            functionBody = initializer.getBody();
          }
        }

        node = functionBody?.isKind(SyntaxKind.Block)
          ? functionBody.getDescendantsOfKind(SyntaxKind.ReturnStatement)[0]?.getExpression()
          : functionBody;

        continue;
      }

      node = undefined;
    }

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
