import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isTelemetryEnabled } from '#helpers/analytics/is-telemetry-enabled.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

describe('isTelemetryEnabled', () => {
  const originalEnv = { ...process.env };
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();

    delete process.env.TYPEBASE_TELEMETRY_DISABLED;
    delete process.env.DO_NOT_TRACK;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    tmp.cleanup();
  });

  it('is enabled by default', async () => {
    expect(await withCwd(tmp.path, () => isTelemetryEnabled())).toBe(true);
  });

  it('is disabled when typebase.json opts out', async () => {
    tmp.write('typebase.json', JSON.stringify({ telemetry: { enabled: false } }));

    expect(await withCwd(tmp.path, () => isTelemetryEnabled())).toBe(false);
  });

  it.each(['TYPEBASE_TELEMETRY_DISABLED', 'DO_NOT_TRACK'])('is disabled when %s is set', async (name) => {
    process.env[name] = '1';

    expect(await withCwd(tmp.path, () => isTelemetryEnabled())).toBe(false);
  });
});
