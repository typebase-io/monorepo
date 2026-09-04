import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { safeReadJsonFile } from '#helpers/shared/safe-read-json-file.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('safeReadJsonFile', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('reads valid JSON', async () => {
    tmp.write('data.json', JSON.stringify({ name: 'typebase' }));

    await expect(safeReadJsonFile(path.join(tmp.path, 'data.json'))).resolves.toEqual({ name: 'typebase' });
  });

  it('returns null when the file does not exist', async () => {
    await expect(safeReadJsonFile(path.join(tmp.path, 'missing.json'))).resolves.toBeNull();
  });

  it('returns null when the file is not valid JSON', async () => {
    tmp.write('invalid.json', '{ invalid');

    await expect(safeReadJsonFile(path.join(tmp.path, 'invalid.json'))).resolves.toBeNull();
  });
});
