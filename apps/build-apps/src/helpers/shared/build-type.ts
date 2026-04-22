import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { replaceTscAliasPaths } from 'tsc-alias';
import ts from 'typescript';

export const buildTypes = async ({
  rootDir,
  srcDir,
  outDir,
  paths,
}: {
  rootDir: string;
  srcDir: string;
  outDir: string;
  paths: Record<string, string[]>;
}) => {
  const configPath = ts.findConfigFile(rootDir, (file) => ts.sys.fileExists(file), 'tsconfig.json');
  const configFile = configPath ? ts.readConfigFile(configPath, (file) => ts.sys.readFile(file)) : undefined;

  if (!configPath || !configFile) {
    throw new Error('tsconfig.json not found');
  }

  if (configFile.error) {
    throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, ts.sys.newLine));
  }

  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));

  ts.createProgram({
    rootNames: parsed.fileNames.filter((file) => file.startsWith(`${srcDir}${path.sep}`)),
    options: {
      ...parsed.options,
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
      declarationMap: false,
      rewriteRelativeImportExtensions: true,
      baseUrl: rootDir,
      outDir,
      paths,
    },
  }).emit();

  const tscAliasConfigPath = path.join(rootDir, 'dist', '.tsc-alias.json');

  await writeFile(
    tscAliasConfigPath,
    `${JSON.stringify(
      {
        extends: configPath,
        compilerOptions: {
          baseUrl: rootDir,
          outDir,
          paths,
        },
      },
      null,
      2
    )}\n`
  );

  await replaceTscAliasPaths({
    configFile: tscAliasConfigPath,
    outDir,
    resolveFullPaths: true,
  });

  await rm(tscAliasConfigPath);
};
