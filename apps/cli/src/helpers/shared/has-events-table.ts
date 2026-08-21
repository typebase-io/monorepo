import { existsSync } from 'node:fs';

import { Project } from 'ts-morph';

export const hasEventsTable = (schemaFilePath: string) => {
  if (!existsSync(schemaFilePath)) {
    return false;
  }

  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const sourceFile = project.addSourceFileAtPath(schemaFilePath);

  const isNamedEvents = sourceFile.getExportDeclarations().some((declaration) => {
    if (declaration.isNamespaceExport()) {
      return true;
    }

    return declaration.getNamedExports().some((namedExport) => (namedExport.getAliasNode() ?? namedExport.getNameNode()).getText() === 'events');
  });

  const isDeclaredEvents = sourceFile.getVariableDeclarations().some((declaration) => declaration.getName() === 'events' && declaration.isExported());

  return isNamedEvents || isDeclaredEvents;
};
