import { type CallExpression, type Node, type ObjectLiteralExpression, SyntaxKind } from 'ts-morph';

const MAX_RESOLVE_DEPTH = 8;

export const resolveDefineOptions = (callExpression: CallExpression, argumentIndex = 0): ObjectLiteralExpression | undefined => {
  let node: Node | undefined = callExpression.getArguments()[argumentIndex];

  for (let depth = 0; node && depth < MAX_RESOLVE_DEPTH; depth++) {
    if (node.isKind(SyntaxKind.ObjectLiteralExpression)) {
      return node;
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

  return undefined;
};
