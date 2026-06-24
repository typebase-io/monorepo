import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateActionsFiles } from '#helpers/generate-server/generate-actions-files.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('generateActionsFiles', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('copies the actions tree and rewrites relative imports to .ts when useTs is true', async () => {
    tmp.write('actions/helper.ts', 'export const x = 1;');
    tmp.write('actions/index.ts', `import { x } from './helper';`);

    await generateActionsFiles({
      actionsDirPath: path.join(tmp.path, 'actions'),
      actionsOutputDirPath: path.join(tmp.path, 'out'),
      useTs: true,
    });

    expect(tmp.exists('out/helper.ts')).toBe(true);
    expect(tmp.read('out/index.ts')).toEqualTemplate('generate-actions-files', 'index-ts.txt');
  });

  it('rewrites relative imports to .js when useTs is false', async () => {
    tmp.write('actions/helper.ts', 'export const x = 1;');
    tmp.write('actions/index.ts', `import { x } from './helper';`);

    await generateActionsFiles({
      actionsDirPath: path.join(tmp.path, 'actions'),
      actionsOutputDirPath: path.join(tmp.path, 'out'),
      useTs: false,
    });

    expect(tmp.read('out/index.ts')).toEqualTemplate('generate-actions-files', 'index-js.txt');
  });
});
