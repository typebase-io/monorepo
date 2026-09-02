import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writeEnvFile } from '#helpers/shared/write-env-file.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

describe('writeEnvFile', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('creates a new .env file when none exists', async () => {
    await withCwd(tmp.path, async () => {
      await writeEnvFile('FOO', 'bar');
    });

    expect(tmp.read('.env')).toBe('FOO=bar\n');
  });

  it('appends a new variable to an existing file', async () => {
    tmp.write('.env', 'EXISTING=1\n');

    await withCwd(tmp.path, async () => {
      await writeEnvFile('FOO', 'bar');
    });

    expect(tmp.read('.env')).toBe('EXISTING=1\nFOO=bar\n');
  });

  it('adds a trailing newline before appending when missing', async () => {
    tmp.write('.env', 'EXISTING=1');

    await withCwd(tmp.path, async () => {
      await writeEnvFile('FOO', 'bar');
    });

    expect(tmp.read('.env')).toBe('EXISTING=1\nFOO=bar\n');
  });

  it('replaces the value of an existing variable in place', async () => {
    tmp.write('.env', 'FOO=old\nOTHER=keep\n');

    await withCwd(tmp.path, async () => {
      await writeEnvFile('FOO', 'new');
    });

    expect(tmp.read('.env')).toBe('FOO=new\nOTHER=keep\n');
  });

  it('writes to an explicitly targeted env file without changing the project env file', async () => {
    tmp.write('.env', 'DATABASE_URL=postgres://project/database\n');

    const serverEnvPath = tmp.write('server/.env', 'DATABASE_URL=postgres://stale/database\nOTHER=keep\n');

    await withCwd(tmp.path, async () => {
      await writeEnvFile('DATABASE_URL', 'postgres://selected/database', serverEnvPath);
    });

    expect(tmp.read('.env')).toBe('DATABASE_URL=postgres://project/database\n');
    expect(tmp.read('server/.env')).toBe('DATABASE_URL=postgres://selected/database\nOTHER=keep\n');
  });

  it('replaces a variable declared with the export prefix', async () => {
    tmp.write('.env', 'export FOO=old\n');

    await withCwd(tmp.path, async () => {
      await writeEnvFile('FOO', 'new');
    });

    expect(tmp.read('.env')).toBe('export FOO=new\n');
  });

  it('preserves an export prefix with multiple spaces', async () => {
    tmp.write('.env', 'export   FOO   =old\n');

    await withCwd(tmp.path, async () => {
      await writeEnvFile('FOO', 'new');
    });

    expect(tmp.read('.env')).toBe('export   FOO=new\n');
  });

  it('preserves blank lines between existing variables', async () => {
    tmp.write('.env', 'FIRST=1\n\n\nFOO=old\n\n\nLAST=3\n');

    await withCwd(tmp.path, async () => {
      await writeEnvFile('FOO', 'new');
    });

    expect(tmp.read('.env')).toBe('FIRST=1\n\n\nFOO=new\n\n\nLAST=3\n');
  });

  it('preserves comments and does not match a commented-out variable', async () => {
    tmp.write('.env', '# database config\n# FOO=commented\nFOO=old\n');

    await withCwd(tmp.path, async () => {
      await writeEnvFile('FOO', 'new');
    });

    expect(tmp.read('.env')).toBe('# database config\n# FOO=commented\nFOO=new\n');
  });

  it('ignores a line with no "=" and appends the variable', async () => {
    tmp.write('.env', 'FOO\nOTHER=keep\n');

    await withCwd(tmp.path, async () => {
      await writeEnvFile('FOO', 'bar');
    });

    expect(tmp.read('.env')).toBe('FOO\nOTHER=keep\nFOO=bar\n');
  });
});
