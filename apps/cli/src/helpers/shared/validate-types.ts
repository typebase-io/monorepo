import path from 'node:path';

import ora from 'ora';
import { Project, ts } from 'ts-morph';

export const validateTypes = ({
  dirPath,
  tsConfigFilePath,
  skipErrors,
  quiet,
}: {
  dirPath: string;
  tsConfigFilePath: string;
  skipErrors: boolean;
  quiet: boolean;
}) => {
  const spinner = quiet ? undefined : ora(`Type-checking \`${path.relative(process.cwd(), dirPath) || '.'}\`...`).start();

  const typeCheckProject = new Project({ tsConfigFilePath });
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
