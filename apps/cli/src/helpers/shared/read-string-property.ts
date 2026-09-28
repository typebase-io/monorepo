import { type ObjectLiteralExpression, SyntaxKind } from 'ts-morph';

export const readStringProperty = (object: ObjectLiteralExpression, name: string, fileName: string) => {
  const property = object.getProperty(name);

  if (!property) {
    return undefined;
  }

  const value = property.asKind(SyntaxKind.PropertyAssignment)?.getInitializer()?.asKind(SyntaxKind.StringLiteral)?.getLiteralValue();

  if (value === undefined) {
    throw new Error(`Could not read \`${name}\` in \`${fileName}\`. Write it as a plain string so the CLI can read it.`);
  }

  return value;
};
