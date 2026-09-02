import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { hashFile } from '#helpers/shared/hash-file.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('hashFile', () => {
  let tmp: TempDir;

  const filePath = () => path.join(tmp.path, 'package.json');

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('hashes a file the same way every time it is unchanged', async () => {
    tmp.write('package.json', '{"name":"@typebase-io/server"}\n');

    await expect(hashFile(filePath())).resolves.toBe(await hashFile(filePath()));
  });

  it('hashes a file differently once its contents change', async () => {
    tmp.write('package.json', '{"name":"@typebase-io/server"}\n');

    const before = await hashFile(filePath());

    tmp.write('package.json', '{"name":"@typebase-io/server","dependencies":{"zod":"4.4.3"}}\n');

    await expect(hashFile(filePath())).resolves.not.toBe(before);
  });

  it('hashes nothing for a file that does not exist', async () => {
    await expect(hashFile(filePath())).resolves.toBe('');
  });

  it('hashes nothing for a directory', async () => {
    tmp.mkdir('package.json');

    await expect(hashFile(filePath())).resolves.toBe('');
  });
});
