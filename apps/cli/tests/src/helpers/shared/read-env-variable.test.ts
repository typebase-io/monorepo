import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readEnvVariable } from '#helpers/shared/read-env-variable.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

describe('readEnvVariable', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
    delete process.env.TYPEBASE_TEST_VAR;
  });

  it('prefers a value from process.env', async () => {
    process.env.TYPEBASE_TEST_VAR = 'from-process';

    tmp.write('.env', 'TYPEBASE_TEST_VAR=from-file\n');

    await withCwd(tmp.path, () => {
      expect(readEnvVariable('TYPEBASE_TEST_VAR')).toBe('from-process');
    });
  });

  it('falls back to the .env file when not in process.env', async () => {
    tmp.write('.env', 'TYPEBASE_TEST_VAR=from-file\n');

    await withCwd(tmp.path, () => {
      expect(readEnvVariable('TYPEBASE_TEST_VAR')).toBe('from-file');
    });
  });

  it('returns undefined when the variable is set nowhere', async () => {
    await withCwd(tmp.path, () => {
      expect(readEnvVariable('TYPEBASE_TEST_VAR')).toBeUndefined();
    });
  });
});
