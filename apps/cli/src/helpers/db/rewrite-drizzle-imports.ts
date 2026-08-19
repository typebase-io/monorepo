import { Project, SyntaxKind } from 'ts-morph';

const NAMESPACE_BY_MODULE = new Map([
  ['drizzle-orm/pg-core', 'p'],
  ['drizzle-orm', 'q'],
]);

interface Edit {
  start: number;
  end: number;
  text: string;
}

export const rewriteDrizzleImports = (source: string): string => {
  const project = new Project({ skipAddingFilesFromTsConfig: true, useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile('source.ts', source);

  const replacementByLocalName = new Map<string, { namespace: string; text: string }>();
  const importRanges: Edit[] = [];
  const namespaces = new Set<string>();
  const edits: Edit[] = [];

  for (const declaration of sourceFile.getImportDeclarations()) {
    const namespace = NAMESPACE_BY_MODULE.get(declaration.getModuleSpecifierValue());

    if (!namespace) {
      continue;
    }

    importRanges.push({ start: declaration.getStart(), end: declaration.getEnd(), text: '' });

    for (const namedImport of declaration.getNamedImports()) {
      const localName = namedImport.getAliasNode()?.getText() ?? namedImport.getName();

      replacementByLocalName.set(localName, { namespace, text: `${namespace}.${namedImport.getName()}` });
    }
  }

  if (importRanges.length === 0) {
    return source;
  }

  for (const identifier of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
    const start = identifier.getStart();

    if (importRanges.some((range) => start >= range.start && start < range.end)) {
      continue;
    }

    const replacement = replacementByLocalName.get(identifier.getText());

    if (!replacement) {
      continue;
    }

    const parent = identifier.getParent();

    if (parent.isKind(SyntaxKind.PropertyAccessExpression) && parent.getNameNode() === identifier) {
      continue;
    }

    if (parent.isKind(SyntaxKind.PropertyAssignment) && parent.getNameNode() === identifier) {
      continue;
    }

    namespaces.add(replacement.namespace);
    edits.push({ start, end: identifier.getEnd(), text: replacement.text });
  }

  const result = [...edits, ...importRanges]
    .sort((a, b) => b.start - a.start)
    .reduce((text, edit) => `${text.slice(0, edit.start)}${edit.text}${text.slice(edit.end)}`, source);

  const header = namespaces.size > 0 ? `import { ${[...namespaces].sort().join(', ')} } from 'typebase-io/db';\n\n` : '';

  return `${header}${result.trimStart()}`;
};
