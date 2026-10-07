import os from 'node:os';

import { Command } from '@commander-js/extra-typings';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { postHogClient } from '#helpers/analytics/posthog-client.ts';
import { trackCommand } from '#helpers/analytics/track-command.ts';

const spies = vi.hoisted(() => ({
  capture: vi.fn(),
  flush: vi.fn(() => Promise.resolve()),
  isTelemetryEnabled: vi.fn(() => Promise.resolve(true)),
  showTelemetryNotice: vi.fn(() => Promise.resolve()),
}));

vi.mock('#helpers/analytics/posthog-client.ts', () => ({ postHogClient: { capture: spies.capture, flush: spies.flush } }));
vi.mock('#helpers/analytics/is-telemetry-enabled.ts', () => ({ isTelemetryEnabled: spies.isTelemetryEnabled }));
vi.mock('#helpers/analytics/show-telemetry-notice.ts', () => ({ showTelemetryNotice: spies.showTelemetryNotice }));
vi.mock('#helpers/shared/get-cli-version.ts', () => ({ getCliVersion: () => '0.1.22' }));

describe('trackCommand', () => {
  const originalEnv = { ...process.env };

  const trackDeploy = async () => {
    const deploy = new Command('deploy').argument('<target>').option('--logs').action(vi.fn());

    new Command('typebase-io-cli').addCommand(deploy).parse(['deploy', 'prod', '--logs'], { from: 'user' });

    await trackCommand(deploy);
  };

  const trackedDistinctId = async ({ hostname, cwd }: { hostname: string; cwd: string }) => {
    vi.spyOn(os, 'hostname').mockReturnValue(hostname);
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);

    await trackDeploy();

    return (spies.capture.mock.lastCall as [{ distinctId: string }])[0].distinctId;
  };

  beforeEach(() => {
    delete process.env.CI;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    vi.restoreAllMocks();
    spies.isTelemetryEnabled.mockResolvedValue(true);
  });

  it('captures the command with its options and sends it right away', async () => {
    await trackDeploy();

    expect(spies.capture).toHaveBeenCalledWith({
      distinctId: expect.stringMatching(/^[0-9a-f]{64}$/) as string,
      event: 'command_run',
      properties: {
        $process_person_profile: false,
        command: 'deploy',
        target: 'prod',
        options: { logs: true },
        cli_version: '0.1.22',
        node_version: process.version,
        os: process.platform,
        arch: process.arch,
        is_ci: false,
      },
    });
    expect(spies.capture).toHaveBeenCalledBefore(spies.flush);
  });

  it('shows the telemetry notice before capturing the command', async () => {
    await trackDeploy();

    expect(spies.showTelemetryNotice).toHaveBeenCalledBefore(spies.capture);
  });

  it('neither shows the notice nor captures the command when telemetry is disabled', async () => {
    spies.isTelemetryEnabled.mockResolvedValue(false);

    await trackDeploy();

    expect(spies.showTelemetryNotice).not.toHaveBeenCalled();
    expect(spies.capture).not.toHaveBeenCalled();
  });

  it('identifies the same project on the same machine with the same hashed id', async () => {
    expect(await trackedDistinctId({ hostname: 'laptop', cwd: '/work/app' })).toBe(await trackedDistinctId({ hostname: 'laptop', cwd: '/work/app' }));
  });

  it('identifies different projects and different machines with different ids', async () => {
    const id = await trackedDistinctId({ hostname: 'laptop', cwd: '/work/app' });

    expect(await trackedDistinctId({ hostname: 'laptop', cwd: '/work/other' })).not.toBe(id);
    expect(await trackedDistinctId({ hostname: 'desktop', cwd: '/work/app' })).not.toBe(id);
  });

  it('reports runs in CI', async () => {
    process.env.CI = 'true';

    await trackDeploy();

    expect(spies.capture).toHaveBeenCalledWith(expect.objectContaining({ properties: expect.objectContaining({ is_ci: true }) as object }));
  });

  it('drops an event that fails to send instead of crashing the command', async () => {
    const unhandled = vi.fn();

    postHogClient.flush = () => Promise.reject(new Error('Network error while fetching PostHog'));
    process.on('unhandledRejection', unhandled);

    try {
      await trackDeploy();

      await new Promise((resolve) => setTimeout(resolve, 10));
    } finally {
      process.off('unhandledRejection', unhandled);
      postHogClient.flush = spies.flush;
    }

    expect(unhandled).not.toHaveBeenCalled();
  });

  it('lets the command run when the notice cannot be recorded', async () => {
    spies.showTelemetryNotice.mockRejectedValueOnce(new Error("EACCES: permission denied, open 'typebase.json'"));

    await expect(trackDeploy()).resolves.toBeUndefined();
    expect(spies.capture).not.toHaveBeenCalled();
  });

  it('lets the command run when capturing throws', async () => {
    spies.capture.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    await expect(trackDeploy()).resolves.toBeUndefined();
  });
});
