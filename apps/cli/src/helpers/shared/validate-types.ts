import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import ora from 'ora';
import { Project, ts } from 'ts-morph';

export const validateTypes = ({
  dirPath,
  tsConfigFilePath,
  skipErrors,
  quiet,
  excludeDirPaths = [],
}: {
  dirPath: string;
  tsConfigFilePath: string;
  skipErrors: boolean;
  quiet: boolean;
  excludeDirPaths?: string[];
}) => {
  const spinner = quiet ? undefined : ora(`Type-checking \`${path.relative(process.cwd(), dirPath) || '.'}\`...`).start();

  const typeCheckProject = new Project({ tsConfigFilePath });

  const nestedPackageDirPaths = existsSync(dirPath)
    ? readdirSync(dirPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && existsSync(path.join(dirPath, entry.name, 'package.json')))
        .map((entry) => path.join(dirPath, entry.name))
    : [];

  const excludePrefixes = [...excludeDirPaths, ...nestedPackageDirPaths].map((excludeDirPath) => `${excludeDirPath.replaceAll('\\', '/')}/`);

  for (const sourceFile of typeCheckProject.getSourceFiles()) {
    if (excludePrefixes.some((prefix) => sourceFile.getFilePath().startsWith(prefix))) {
      typeCheckProject.removeSourceFile(sourceFile);
    }
  }

  const diagnostics = typeCheckProject.getPreEmitDiagnostics();

  if (diagnostics.length > 0) {
    const formattedDiagnostics = ts.formatDiagnosticsWithColorAndContext(
      diagnostics.map((diagnostic) => diagnostic.compilerObject),
      {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => dirPath,
        getNewLine: () => ts.sys.newLine,
      }
    );

    spinner?.stop();
    console.error(formattedDiagnostics);

    if (skipErrors) {
      return;
    }

    throw new Error(`Type checking failed in \`${dirPath}\`.`);
  }

  spinner?.succeed('Type check passed.');
};
