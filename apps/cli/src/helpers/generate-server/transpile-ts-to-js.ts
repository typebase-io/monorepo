import ora from 'ora';
import { ts } from 'ts-morph';

export const transpileTsToJs = ({
  tsConfigFilePath,
  cjs,
  quiet,
  tempServerDirPath,
  serverDistDirPath,
}: {
  tsConfigFilePath: string;
  cjs: boolean;
  quiet: boolean;
  tempServerDirPath: string;
  serverDistDirPath: string;
}) => {
  const spinner = quiet ? undefined : ora(cjs ? 'Transpiling to CJS...' : 'Transpiling to ESM...').start();

  const serverTSConfigResult = ts.readConfigFile(tsConfigFilePath, (filePath) => ts.sys.readFile(filePath));
  const parsedServerTSConfig = ts.parseJsonConfigFileContent(serverTSConfigResult.config, ts.sys, tempServerDirPath, undefined, tsConfigFilePath);

  const transpileProgram = ts.createProgram({
    rootNames: parsedServerTSConfig.fileNames,
    options: {
      ...parsedServerTSConfig.options,
      noEmit: false,
      emitDeclarationOnly: false,
      declaration: false,
      sourceMap: false,
      allowImportingTsExtensions: false,
      module: cjs ? ts.ModuleKind.CommonJS : parsedServerTSConfig.options.module,
      moduleResolution: parsedServerTSConfig.options.moduleResolution,
      rootDir: tempServerDirPath,
      outDir: serverDistDirPath,
      rewriteRelativeImportExtensions: true,
    },
  });

  const syntacticDiagnostics = transpileProgram.getSyntacticDiagnostics();

  if (syntacticDiagnostics.length > 0) {
    const formatted = ts.formatDiagnostics(syntacticDiagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => tempServerDirPath,
      getNewLine: () => '\n',
    });

    spinner?.fail('Transpilation failed.');

    throw new Error(`The generated server contains syntax errors:\n${formatted}`);
  }

  transpileProgram.emit();

  spinner?.succeed('Transpiled!');
};
