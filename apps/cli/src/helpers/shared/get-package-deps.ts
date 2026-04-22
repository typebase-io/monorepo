import { builtinModules } from 'node:module';

import { Project, SyntaxKind } from 'ts-morph';

import { getUserPackageJson } from '#helpers/shared/get-user-package-json.ts';
import { isTsFile } from '#helpers/shared/is-ts-file.ts';
import { walk } from '#helpers/shared/walk.ts';

export const getPackageDeps = async ({ sourceDirPath, skipDirs }: { sourceDirPath: string; skipDirs?: (dirName: string) => boolean }) => {
  const packageJson = await getUserPackageJson(sourceDirPath);

  const allDeps: Record<string, string> = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
  };

  const files = await walk(sourceDirPath, { recursive: true, filter: isTsFile, skipDirs });
  const project = new Project({ useInMemoryFileSystem: false, skipLoadingLibFiles: true, skipFileDependencyResolution: true });

  const alreadyAddedDependencies = new Set<string>();
  const dependencies = new Map<string, string>();

  for (const filePath of files) {
    const sourceFile = project.getSourceFile(filePath) ?? project.addSourceFileAtPath(filePath);
    const specifiers: string[] = [];

    sourceFile.getImportDeclarations().forEach((importDecl) => {
      specifiers.push(importDecl.getModuleSpecifierValue());
    });

    sourceFile.getExportDeclarations().forEach((exportDecl) => {
      const specifier = exportDecl.getModuleSpecifierValue();

      if (specifier) {
        specifiers.push(exportDecl.getModuleSpecifierValue() ?? '');
      }
    });

    sourceFile.getDescendantsOfKind(SyntaxKind.ImportKeyword).forEach((callExpression) => {
      const callExpr = callExpression.getParentIfKind(SyntaxKind.CallExpression);
      const arg = callExpr?.getArguments()[0];

      if (arg?.getKind() === SyntaxKind.StringLiteral) {
        specifiers.push(arg.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue());
      }
    });

    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((callExpression) => {
      const expression = callExpression.getExpression();

      if (expression.getKind() === SyntaxKind.Identifier && expression.getText() === 'require') {
        const arg = callExpression.getArguments()[0];

        if (arg?.getKind() === SyntaxKind.StringLiteral) {
          specifiers.push(arg.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue());
        }
      }
    });

    specifiers.forEach((specifier) => {
      if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('#')) {
        return;
      }

      if (specifier.startsWith('node:')) {
        return;
      }

      const [firstSegment, secondSegment] = specifier.split('/');
      const packageName = firstSegment?.startsWith('@') ? `${firstSegment}/${secondSegment ?? ''}` : firstSegment;
      const packageVersion = packageName ? (allDeps[packageName] ?? '*') : '*';

      if (!packageName) {
        return;
      }

      if (builtinModules.includes(packageName)) {
        return;
      }

      if (alreadyAddedDependencies.has(packageName)) {
        return;
      }

      dependencies.set(packageName, packageVersion);
      alreadyAddedDependencies.add(packageName);
    });
  }

  return Object.fromEntries(dependencies);
};
