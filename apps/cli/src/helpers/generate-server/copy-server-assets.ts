import fs from 'node:fs/promises';
import path from 'node:path';

import { isTsFile } from '#helpers/shared/is-ts-file.ts';
import { walk } from '#helpers/shared/walk.ts';

export const copyServerAssets = async ({ tempServerDirPath, serverDistDirPath }: { tempServerDirPath: string; serverDistDirPath: string }) => {
  const sourceDirPath = path.join(tempServerDirPath, 'src');
  const assets = await walk(sourceDirPath, { filter: (filePath) => !isTsFile(filePath) });

  for (const asset of assets) {
    const target = path.join(serverDistDirPath, 'src', path.relative(sourceDirPath, asset));

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(asset, target);
  }

  return assets.length;
};
