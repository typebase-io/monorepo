import { Project, SyntaxKind } from 'ts-morph';

import { formatPulledSource } from '#helpers/db/format-pulled-source.ts';
import { rewriteDrizzleImports } from '#helpers/db/rewrite-drizzle-imports.ts';

export const toTypebaseRelations = ({ source, tableNames }: { source: string; tableNames: string[] }): string => {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    useInMemoryFileSystem: true,
    manipulationSettings: { useTrailingCommas: true },
  });

  const sourceFile = project.createSourceFile('relations.ts', rewriteDrizzleImports(source));

  for (const declaration of sourceFile.getImportDeclarations()) {
    if (declaration.getModuleSpecifierValue() === './schema') {
      declaration.setModuleSpecifier('./schema.ts');
    }
  }

  const callbackBody = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((callExpr) => callExpr.getExpression().getText() === 'q.defineRelations')
    ?.getArguments()[1]
    ?.asKind(SyntaxKind.ArrowFunction)
    ?.getBody();

  const relationsCallback = callbackBody?.asKind(SyntaxKind.ParenthesizedExpression)?.getExpression() ?? callbackBody;
  const relationsObject = relationsCallback?.asKind(SyntaxKind.ObjectLiteralExpression);

  if (!relationsObject) {
    throw new Error('Could not read the relations generated for that database: expected a `defineRelations(schema, (r) => ({ ... }))` call.');
  }

  const registered = new Set(
    relationsObject.getProperties().flatMap((property) => (property.isKind(SyntaxKind.PropertyAssignment) ? [property.getName()] : []))
  );

  for (const name of tableNames) {
    if (!registered.has(name)) {
      relationsObject.addPropertyAssignment({ name, initializer: '{}' });
    }
  }

  return formatPulledSource(sourceFile.getFullText());
};
