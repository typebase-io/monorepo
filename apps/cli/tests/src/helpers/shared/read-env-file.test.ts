import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readEnvFile } from '#helpers/shared/read-env-file.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

describe('readEnvFile', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('returns an empty object when no .env file exists', async () => {
    await withCwd(tmp.path, () => {
      expect(readEnvFile()).toEqual({});
    });
  });

  it('parses key/value pairs from the .env file', async () => {
    tmp.write('.env', 'FOO=bar\nBAZ=qux\n');

    await withCwd(tmp.path, () => {
      expect(readEnvFile()).toEqual({ FOO: 'bar', BAZ: 'qux' });
    });
  });

  it('ignores comments and blank lines', async () => {
    tmp.write('.env', '# a comment\n\nFOO=bar\n');

    await withCwd(tmp.path, () => {
      expect(readEnvFile()).toEqual({ FOO: 'bar' });
    });
  });

  it('strips a leading "export" keyword from a key', async () => {
    tmp.write('.env', 'export FOO=bar\n');

    await withCwd(tmp.path, () => {
      expect(readEnvFile()).toEqual({ FOO: 'bar' });
    });
  });

  it('parses values separated by multiple blank lines', async () => {
    tmp.write('.env', 'FOO=bar\n\n\n\nBAZ=qux\n');

    await withCwd(tmp.path, () => {
      expect(readEnvFile()).toEqual({ FOO: 'bar', BAZ: 'qux' });
    });
  });

  it('trims many spaces between the key and the value', async () => {
    tmp.write('.env', 'FOO     =     bar\n');

    await withCwd(tmp.path, () => {
      expect(readEnvFile()).toEqual({ FOO: 'bar' });
    });
  });

  it('ignores a line with no "=" between the key and the value', async () => {
    tmp.write('.env', 'FOO bar\nBAZ=qux\n');

    await withCwd(tmp.path, () => {
      expect(readEnvFile()).toEqual({ BAZ: 'qux' });
    });
  });
});
