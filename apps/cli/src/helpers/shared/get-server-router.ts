import path from 'node:path';

import { Project, VariableDeclarationKind } from 'ts-morph';

import { buildRouterTree } from '#helpers/shared/build-router-tree.ts';
import { isTsFile } from '#helpers/shared/is-ts-file.ts';
import { renderRouterObject } from '#helpers/shared/render-router-object.ts';
import { stripExtension } from '#helpers/shared/strip-extension.ts';
import { walk } from '#helpers/shared/walk.ts';

export const getServerRouter = async ({
  tsConfigFilePath,
  actionsDirPath,
  outputFilePath,
  actionsOutputDirPath,
  generation,
  exportable,
}: {
  tsConfigFilePath: string;
  actionsDirPath: string;
  outputFilePath: string;
  actionsOutputDirPath: string;
  generation: 'ts' | 'esm' | 'cjs';
  exportable: boolean;
}) => {
  const project = new Project({ tsConfigFilePath });
  const actionFiles = await walk(actionsDirPath, { recursive: true, filter: isTsFile });

  const imports: string[] = [];

  const routes = actionFiles
    .flatMap((filePath, index) => {
      const sourceFile = project.getSourceFile(filePath) ?? project.addSourceFileAtPath(filePath);

      const actions = sourceFile
        .getVariableStatements()
        .filter((vs) => vs.isExported())
        .flatMap((vs) => vs.getDeclarations())
        .filter((decl) => decl.getVariableStatementOrThrow().getDeclarationKind() === VariableDeclarationKind.Const)
        .flatMap((decl) => {
          const hasORPC = decl
            .getType()
            .getProperties()
            .some((p) => p.getName() === '~orpc');

          if (!hasORPC) return [];

          return decl.getName();
        });

      if (actions.length === 0) {
        return [];
      }

      const relativeActionPath = stripExtension(path.relative(actionsDirPath, filePath)).replaceAll('\\', '/');
      const importAlias = `ActionModule${index}`;

      const ext = generation === 'ts' ? '.ts' : '.js';

      let importPath = (
        stripExtension(path.relative(path.dirname(outputFilePath), path.join(actionsOutputDirPath, relativeActionPath))) + ext
      ).replaceAll('\\', '/');

      if (!importPath.startsWith('.')) {
        importPath = `./${importPath}`;
      }

      imports.push(`import * as ${importAlias} from "${importPath}";`);

      const segments = relativeActionPath.split('/');
      const fileName = segments.pop() ?? '';

      const routerLeaf = `{ ${actions
        .toSorted()
        .map((actionName) => `${JSON.stringify(actionName)}: ${importAlias}.${actionName}`)
        .join(', ')} }`;

      return {
        pathSegments: segments,
        leaves: { [fileName]: routerLeaf },
      };
    })
    .sort((a, b) => a.pathSegments.join('/').localeCompare(b.pathSegments.join('/')));

  const routerTree = buildRouterTree(routes);
  const importsBlock = imports.toSorted().join('\n');
  const routerObject = renderRouterObject(routerTree);
  const routerCode = exportable ? `export const router = {\n${routerObject}\n};` : `const router = {\n${routerObject}\n};`;

  return [importsBlock, routerCode] as const;
};
