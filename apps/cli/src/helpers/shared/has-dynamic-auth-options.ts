import { type ObjectLiteralExpression, SyntaxKind } from 'ts-morph';

export const hasDynamicAuthOptions = (options: ObjectLiteralExpression) => {
  return options
    .getProperties()
    .some((property) => property.isKind(SyntaxKind.SpreadAssignment) || property.getFirstChildByKind(SyntaxKind.ComputedPropertyName) !== undefined);
};
