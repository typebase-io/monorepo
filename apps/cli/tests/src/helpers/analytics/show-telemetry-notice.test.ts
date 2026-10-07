import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { showTelemetryNotice } from '#helpers/analytics/show-telemetry-notice.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

describe('showTelemetryNotice', () => {
  let tmp: TempDir;

  const printed = () => vi.mocked(console.error).mock.calls.flat().map(String).join('\n');

  beforeEach(() => {
    tmp = createTempDir();

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    tmp.cleanup();
    vi.restoreAllMocks();
  });

  it('prints the notice and records it in a new typebase.json', async () => {
    await withCwd(tmp.path, () => showTelemetryNotice());

    expect(printed()).toEqualTemplate('telemetry-notice', 'notice.txt');
    expect(tmp.read('typebase.json')).toEqualTemplate('telemetry-notice', 'new-typebase.json.txt');
  });

  it('records the notice next to the existing settings', async () => {
    tmp.write('typebase.json', JSON.stringify({ serverProvider: 'vercel' }));

    await withCwd(tmp.path, () => showTelemetryNotice());

    expect(tmp.read('typebase.json')).toEqualTemplate('telemetry-notice', 'existing-typebase.json.txt');
  });

  it('prints nothing once the notice has been shown', async () => {
    const config = JSON.stringify({ telemetry: { noticeShown: true } });

    tmp.write('typebase.json', config);

    await withCwd(tmp.path, () => showTelemetryNotice());

    expect(console.error).not.toHaveBeenCalled();
    expect(tmp.read('typebase.json')).toBe(config);
  });

  it('shows the notice only on the first run', async () => {
    await withCwd(tmp.path, async () => {
      await showTelemetryNotice();
      await showTelemetryNotice();
    });

    expect(console.error).toHaveBeenCalledOnce();
  });
});
