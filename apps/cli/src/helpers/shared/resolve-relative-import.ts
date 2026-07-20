import fs from 'node:fs';
import path from 'node:path';

export const resolveRelativeImport = (fromFile: string, specifier: string, ext: 'ts' | 'js') => {
  const dir = path.dirname(fromFile);

  for (const srcExt of ['.ts', '.tsx', '.mts', '.cts']) {
    if (fs.existsSync(path.join(dir, specifier + srcExt))) {
      return specifier + (ext === 'ts' ? srcExt : srcExt.replace(/ts$/, 'js'));
    }

    if (fs.existsSync(path.join(dir, specifier, `index${srcExt}`))) {
      const outExt = ext === 'ts' ? srcExt : srcExt.replace(/ts$/, 'js');

      return `${specifier}/index${outExt}`;
    }
  }

  return specifier + (ext === 'ts' ? '.ts' : '.js');
};
