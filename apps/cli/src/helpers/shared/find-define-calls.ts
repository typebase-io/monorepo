import { type CallExpression, type SourceFile, SyntaxKind } from 'ts-morph';

export const findDefineCalls = (sourceFile: SourceFile, functionName: string): CallExpression[] => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpr) => callExpr.getExpression().getText() === functionName);
};
