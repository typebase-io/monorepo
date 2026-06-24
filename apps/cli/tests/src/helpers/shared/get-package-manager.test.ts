import { preferredPM } from 'preferred-pm';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getPackageManager } from '#helpers/shared/get-package-manager.ts';

vi.mock('preferred-pm', () => ({ preferredPM: vi.fn() }));

describe('getPackageManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns "unknown" when no package manager is detected', async () => {
    vi.mocked(preferredPM).mockResolvedValue(null);

    expect(await getPackageManager()).toBe('unknown');
  });

  it('maps yarn v1 to "yarn-classic"', async () => {
    vi.mocked(preferredPM).mockResolvedValue({ name: 'yarn', version: '1.22.19' });

    expect(await getPackageManager()).toBe('yarn-classic');
  });

  it('maps yarn v2+ to "yarn-berry"', async () => {
    vi.mocked(preferredPM).mockResolvedValue({ name: 'yarn', version: '3.6.4' });

    expect(await getPackageManager()).toBe('yarn-berry');
  });

  it('maps yarn v2 exactly to "yarn-berry"', async () => {
    vi.mocked(preferredPM).mockResolvedValue({ name: 'yarn', version: '2' });

    expect(await getPackageManager()).toBe('yarn-berry');
  });

  it('passes through other package managers by name', async () => {
    vi.mocked(preferredPM).mockResolvedValue({ name: 'pnpm', version: '9.1.0' });

    expect(await getPackageManager()).toBe('pnpm');
  });
});
