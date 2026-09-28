import { select } from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VercelClient } from '#helpers/deploy/vercel/client.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { getVercelStorageTeam } from '#helpers/storage/vercel/get-vercel-storage-team.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

const teams = vi.hoisted(() => ({ list: [] as { id: string; name: string; slug: string }[] }));

vi.mock('#helpers/deploy/vercel/client.ts', () => ({
  VercelClient: vi.fn(function () {
    return { listTeams: vi.fn(() => Promise.resolve(teams.list)) };
  }),
}));

describe('getVercelStorageTeam', () => {
  let tmp: TempDir;

  const getTeam = (config: Record<string, unknown>) => {
    tmp.write('typebase.json', JSON.stringify(config));

    return withCwd(tmp.path, async () => getVercelStorageTeam({ token: 'vercel-token', config: await getTypebaseConfig() }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(select).mockReset();

    tmp = createTempDir();

    teams.list = [
      { id: 'team_acme', name: 'Acme', slug: 'acme' },
      { id: 'team_beta', name: 'Beta', slug: 'beta' },
    ];
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('reads the saved team without asking or reaching Vercel', async () => {
    await expect(getTeam({ storage: { vercel: { orgId: 'team_saved' } } })).resolves.toEqual({ orgId: 'team_saved', isNew: false });

    expect(VercelClient).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  it('asks which team to keep the Blob stores in when none is saved', async () => {
    vi.mocked(select).mockResolvedValue('team_beta');

    await expect(getTeam({})).resolves.toEqual({ orgId: 'team_beta', isNew: true });

    expect(VercelClient).toHaveBeenCalledWith({ token: 'vercel-token', orgId: undefined });
    expect(select).toHaveBeenCalledWith({
      message: 'Select the Vercel team that holds your Blob stores:',
      choices: [
        { name: 'Acme (acme)', value: 'team_acme' },
        { name: 'Beta (beta)', value: 'team_beta' },
      ],
    });
  });

  it('fails without asking when the token reaches no team', async () => {
    teams.list = [];

    await expect(getTeam({})).rejects.toThrow(
      'Your Vercel token cannot reach any team to keep Blob stores in. Create a token with access to a team, then sync again.'
    );

    expect(select).not.toHaveBeenCalled();
  });
});
