import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

const transformImportsPlugin: string = require.resolve('@swc/plugin-transform-imports');

export const transpile = async ({
  rootDir,
  srcDir,
  outDir,
  moduleType,
  paths,
}: {
  rootDir: string;
  srcDir: string;
  outDir: string;
  moduleType: 'nodenext' | 'commonjs';
  paths: Record<string, string[]>;
}) => {
  const { swcDir } = require('@swc/cli') as {
    swcDir: (args: { cliOptions: Record<string, unknown>; swcOptions: Record<string, unknown> }) => Promise<void>;
  };

  await swcDir({
    cliOptions: {
      outDir,
      watch: false,
      filenames: [srcDir],
      extensions: ['.ts'],
      stripLeadingPaths: false,
      deleteDirOnStart: true,
      sync: false,
    },
    swcOptions: {
      sourceMaps: false,
      module: {
        type: moduleType,
        resolveFully: true,
      },
      jsc: {
        target: 'esnext',
        baseUrl: rootDir,
        parser: {
          syntax: 'typescript',
          tsx: false,
        },
        paths,
        experimental: {
          plugins: [
            [
              transformImportsPlugin,
              {
                '^(.*?)\\.ts(x)?$': {
                  skipDefaultConversion: true,
                  transform: '{{matches.[1]}}.js',
                },
              },
            ],
          ],
        },
      },
    },
  });

  await writeFile(path.join(outDir, 'package.json'), `${JSON.stringify({ type: moduleType === 'commonjs' ? 'commonjs' : 'module' }, null, 2)}\n`);
};
