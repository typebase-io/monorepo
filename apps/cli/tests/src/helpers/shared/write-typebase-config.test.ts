import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TYPEBASE_CONFIG_SCHEMA_URL } from '#helpers/constants.ts';
import { writeTypebaseConfig } from '#helpers/shared/write-typebase-config.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

describe('writeTypebaseConfig', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('creates typebase.json with the $schema reference', async () => {
    await withCwd(tmp.path, async () => {
      await writeTypebaseConfig({ projectPath: 'src/typebase' });
    });

    const written = JSON.parse(tmp.read('typebase.json')) as Record<string, unknown>;

    expect(written.$schema).toBe(TYPEBASE_CONFIG_SCHEMA_URL);
    expect(written.projectPath).toBe('src/typebase');
  });

  it('ends the file with a trailing newline', async () => {
    await withCwd(tmp.path, async () => {
      await writeTypebaseConfig({ projectPath: 'typebase' });
    });

    expect(tmp.read('typebase.json').endsWith('}\n')).toBe(true);
  });

  it('merges updates into existing config and keeps untouched keys', async () => {
    tmp.write('typebase.json', JSON.stringify({ projectPath: 'old', serverProvider: 'vercel' }));

    await withCwd(tmp.path, async () => {
      await writeTypebaseConfig({ projectPath: 'new' });
    });

    const written = JSON.parse(tmp.read('typebase.json')) as Record<string, unknown>;

    expect(written.projectPath).toBe('new');
    expect(written.serverProvider).toBe('vercel');
    expect(written.$schema).toBe(TYPEBASE_CONFIG_SCHEMA_URL);
  });
});
