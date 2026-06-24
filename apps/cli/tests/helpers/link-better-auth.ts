import fs from 'node:fs';
import path from 'node:path';

import { type TempDir } from '#tests/helpers/temp-dir.ts';

const betterAuthDir = fs.realpathSync(path.resolve('node_modules/better-auth'));

export const linkBetterAuth = (tmp: TempDir) => {
  fs.mkdirSync(path.join(tmp.path, 'node_modules'), { recursive: true });
  fs.symlinkSync(betterAuthDir, path.join(tmp.path, 'node_modules/better-auth'), 'dir');
};
