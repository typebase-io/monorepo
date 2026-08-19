import { Project, SyntaxKind, ts } from 'ts-morph';

export const formatPulledSource = (source: string): string => {
  const project = new Project({ skipAddingFilesFromTsConfig: true, useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile('source.ts', source);

  const quoteEdits = sourceFile
    .getDescendantsOfKind(SyntaxKind.StringLiteral)
    .filter((literal) => literal.getText().startsWith('"') && !literal.getText().includes('\\') && !literal.getLiteralValue().includes("'"))
    .map((literal) => ({ start: literal.getStart(), end: literal.getEnd(), text: `'${literal.getLiteralValue()}'` }));

  const bracketEdits = sourceFile
    .getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression)
    .filter((array) => array.getText().includes('\n') && !/\n\s*]$/.test(array.getText()))
    .map((array) => ({ start: array.getEnd() - 1, end: array.getEnd() - 1, text: '\n' }));

  const rewritten = [...quoteEdits, ...bracketEdits]
    .sort((a, b) => b.start - a.start)
    .reduce((text, edit) => `${text.slice(0, edit.start)}${edit.text}${text.slice(edit.end)}`, source);

  const formattedFile = project.createSourceFile('formatted.ts', rewritten);

  formattedFile.formatText({ convertTabsToSpaces: true, indentSize: 2, tabSize: 2, semicolons: ts.SemicolonPreference.Insert });

  const spaced = formattedFile.getFullText().replaceAll(/\n(export )/g, '\n\n$1');

  return `${spaced.replaceAll(/\n{3,}/g, '\n\n').trimEnd()}\n`;
};
