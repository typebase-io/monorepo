import path from 'node:path';

import { expect } from 'vitest';

import { listFiles } from '#tests/helpers/list-files.ts';
import { type TempDir } from '#tests/helpers/temp-dir.ts';

export const expectProject = (
  tmp: TempDir,
  outcome: string,
  files: string[],
  { namespace, root = 'typebase' }: { namespace: string; root?: string }
) => {
  expect(listFiles(path.join(tmp.path, root))).toEqual([...files].sort());

  for (const file of files) {
    expect(tmp.read(`${root}/${file}`)).toEqualTemplate(namespace, outcome, ...`${file}.txt`.split('/'));
  }
};
