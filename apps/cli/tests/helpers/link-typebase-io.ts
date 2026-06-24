import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { type TempDir } from '#tests/helpers/temp-dir.ts';

const coreDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../core');

interface CorePackage {
  exports: Record<string, string | Record<string, string>>;
  [key: string]: unknown;
}

const toSource = (distPath: string) =>
  distPath
    .replace(/^\.\/dist\/(types|esm|cjs)\//, './')
    .replace(/\.d\.ts$/, '.ts')
    .replace(/\.js$/, '.ts');

export const linkTypebaseIo = (tmp: TempDir) => {
  const pkgDir = path.join(tmp.path, 'node_modules/typebase-io');

  fs.mkdirSync(pkgDir, { recursive: true });

  const corePkg = JSON.parse(fs.readFileSync(path.join(coreDir, 'package.json'), 'utf8')) as CorePackage;

  corePkg.exports = Object.fromEntries(
    Object.entries(corePkg.exports).map(([key, value]) => [
      key,
      typeof value === 'string' ? toSource(value) : Object.fromEntries(Object.entries(value).map(([condition, p]) => [condition, toSource(p)])),
    ])
  );

  fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify(corePkg));
  fs.symlinkSync(path.join(coreDir, 'src'), path.join(pkgDir, 'src'), 'dir');
};
