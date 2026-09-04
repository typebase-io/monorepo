import { type ObjectLiteralExpression, SyntaxKind } from 'ts-morph';

export const getAuthBasePathProperty = (options: ObjectLiteralExpression) =>
  options.getProperty((property) => {
    if (property.isKind(SyntaxKind.SpreadAssignment)) return false;

    const nameNode = property.getNameNode();
    const name = nameNode.isKind(SyntaxKind.ComputedPropertyName) ? nameNode.getExpression() : nameNode;

    return name.isKind(SyntaxKind.StringLiteral) ? name.getLiteralText() === 'basePath' : nameNode.getText() === 'basePath';
  });
