import fs from 'node:fs';
import path from 'node:path';

import { type TempDir } from '#tests/helpers/temp-dir.ts';

const zodDir = fs.realpathSync(path.resolve('node_modules/zod'));

export const linkZod = (tmp: TempDir) => {
  fs.mkdirSync(path.join(tmp.path, 'node_modules'), { recursive: true });
  fs.symlinkSync(zodDir, path.join(tmp.path, 'node_modules/zod'), 'dir');
};
