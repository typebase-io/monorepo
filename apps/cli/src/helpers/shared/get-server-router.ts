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
  let hasAnyAction = false;

  const routes = actionFiles
    .flatMap((filePath, index) => {
      const sourceFile = project.getSourceFile(filePath) ?? project.addSourceFileAtPath(filePath);

      const fileHasORPC = sourceFile
        .getVariableStatements()
        .filter((vs) => vs.isExported())
        .flatMap((vs) => vs.getDeclarations())
        .filter((decl) => decl.getVariableStatementOrThrow().getDeclarationKind() === VariableDeclarationKind.Const)
        .some((decl) =>
          decl
            .getType()
            .getProperties()
            .some((p) => p.getName() === '~orpc')
        );

      if (!fileHasORPC) {
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
      hasAnyAction = true;

      const segments = relativeActionPath.split('/');
      const fileName = segments.pop() ?? '';

      return {
        pathSegments: segments,
        leaves: { [fileName]: `filterActions(${importAlias})` },
      };
    })
    .sort((a, b) => a.pathSegments.join('/').localeCompare(b.pathSegments.join('/')));

  const routerTree = buildRouterTree(routes);
  const importsBlock = (hasAnyAction as boolean) ? `import { filterActions } from "typebase-io/server";\n\n${imports.toSorted().join('\n')}` : '';
  const routerObject = renderRouterObject(routerTree);
  const routerBody = routerObject ? `{\n${routerObject}\n}` : '{}';
  const routerCode = `${exportable ? 'export ' : ''}const router = ${routerBody};`;

  return [importsBlock, routerCode] as const;
};
