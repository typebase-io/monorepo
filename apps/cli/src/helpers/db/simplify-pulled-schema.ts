import { type CallExpression, Project, SyntaxKind } from 'ts-morph';

interface Edit {
  start: number;
  end: number;
  text: string;
}

export const simplifyPulledSchema = (source: string): string => {
  const project = new Project({ skipAddingFilesFromTsConfig: true, useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile('schema.ts', source);
  const edits: Edit[] = [];

  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    let edit: Edit | undefined;

    const expression = call.getExpression();

    // Simplify Default Now
    const defaultCall = expression.isKind(SyntaxKind.PropertyAccessExpression) && expression.getName() === 'default' ? call : undefined;
    const argument = defaultCall?.getArguments()[0];

    if (defaultCall && argument?.getText() === 'q.sql`now()`') {
      const nameNode = defaultCall.getExpression().asKindOrThrow(SyntaxKind.PropertyAccessExpression).getNameNode();

      edit = { start: nameNode.getStart(), end: call.getEnd(), text: 'defaultNow()' };
    }

    // Simplify Index Columns
    const usingCall = expression.isKind(SyntaxKind.PropertyAccessExpression) && expression.getName() === 'using' ? call : undefined;
    const [method, ...columns] = usingCall?.getArguments() ?? [];

    if (usingCall && method?.asKind(SyntaxKind.StringLiteral)?.getLiteralValue() === 'btree' && columns.length !== 0) {
      const plainColumns = columns.map((column) => /^(.+)\.asc\(\)\.nullsLast\(\)$/.exec(column.getText())?.[1]);

      if (plainColumns.every((column) => column !== undefined)) {
        const nameNode = usingCall.getExpression().asKindOrThrow(SyntaxKind.PropertyAccessExpression).getNameNode();

        edit = { start: nameNode.getStart(), end: call.getEnd(), text: `on(${plainColumns.join(', ')})` };
      }
    }

    if (edit) {
      edits.push(edit);
    }
  }

  for (const table of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (table.getExpression().getText() !== 'p.pgTable') {
      continue;
    }

    const columns = table.getArguments()[1]?.asKind(SyntaxKind.ObjectLiteralExpression);
    const extras = table.getArguments()[2]?.asKind(SyntaxKind.ArrowFunction)?.getBody().asKind(SyntaxKind.ArrayLiteralExpression);

    if (!columns || !extras) {
      continue;
    }

    const inlined = extras.getElements().filter((element) => {
      const elementExpression = element.isKind(SyntaxKind.CallExpression) ? element.getExpression() : undefined;

      const onCall = (
        elementExpression?.isKind(SyntaxKind.PropertyAccessExpression) && elementExpression.getName() === 'on' ? element : undefined
      ) as CallExpression | undefined;

      const uniqueCall = onCall?.getExpression().asKind(SyntaxKind.PropertyAccessExpression)?.getExpression();
      const uniqueCallExpression = uniqueCall?.isKind(SyntaxKind.CallExpression) ? uniqueCall.getExpression() : undefined;

      const nameCall = (
        uniqueCallExpression?.isKind(SyntaxKind.PropertyAccessExpression) && uniqueCallExpression.getName() === 'unique' ? uniqueCall : undefined
      ) as CallExpression | undefined;

      const name = uniqueCall && nameCall?.getArguments()[0]?.getText();
      const columnName = onCall?.getArguments()[0]?.getText();

      const unique =
        onCall?.getArguments().length !== 1 || !columnName?.startsWith('table.') || !name
          ? undefined
          : { name, columnName: columnName.slice('table.'.length) };

      const column = unique && columns.getProperty(unique.columnName)?.asKind(SyntaxKind.PropertyAssignment);

      if (!unique || !column) {
        return false;
      }

      edits.push({ start: column.getEnd(), end: column.getEnd(), text: `.unique(${unique.name})` });

      return true;
    });

    if (inlined.length === 0) {
      continue;
    }

    if (inlined.length === extras.getElements().length) {
      edits.push({ start: columns.getEnd(), end: extras.getEnd(), text: '' });

      continue;
    }

    for (const element of inlined) {
      const leadingBreak = /\n[ \t]*$/.exec(source.slice(0, element.getStart()))?.[0].length ?? 0;
      const trailingComma = /^\s*,/.exec(source.slice(element.getEnd()))?.[0].length ?? 0;

      edits.push({ start: element.getStart() - leadingBreak, end: element.getEnd() + trailingComma, text: '' });
    }
  }

  return edits.sort((a, b) => b.start - a.start).reduce((text, edit) => `${text.slice(0, edit.start)}${edit.text}${text.slice(edit.end)}`, source);
};
