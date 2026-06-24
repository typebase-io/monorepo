import { select } from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getNeonOrganization } from '#helpers/db/neon/get-neon-organization.ts';

const createApiClient = () => ({ getCurrentUserOrganizations: vi.fn() });

describe('getNeonOrganization', () => {
  let apiClient: ReturnType<typeof createApiClient>;

  beforeEach(() => {
    apiClient = createApiClient();

    vi.clearAllMocks();
    vi.mocked(select).mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits when the Neon account has no organizations', async () => {
    apiClient.getCurrentUserOrganizations.mockResolvedValue({ data: { organizations: [] } });

    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);

    await expect(getNeonOrganization(apiClient as never)).rejects.toThrow('process.exit called');

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('No Neon organizations found for your account.'));
    expect(select).not.toHaveBeenCalled();
  });

  it('returns the single organization without prompting', async () => {
    apiClient.getCurrentUserOrganizations.mockResolvedValue({
      data: { organizations: [{ id: 'org-1', name: 'Main Org' }] },
    });

    await expect(getNeonOrganization(apiClient as never)).resolves.toBe('org-1');

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Using Neon organization: Main Org'));
    expect(select).not.toHaveBeenCalled();
  });

  it('falls back to an empty id if a malformed single organization response is returned', async () => {
    apiClient.getCurrentUserOrganizations.mockResolvedValue({
      data: { organizations: [undefined] },
    });

    await expect(getNeonOrganization(apiClient as never)).resolves.toBe('');

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Using Neon organization: '));
    expect(select).not.toHaveBeenCalled();
  });

  it('prompts when multiple organizations are available', async () => {
    apiClient.getCurrentUserOrganizations.mockResolvedValue({
      data: {
        organizations: [
          { id: 'org-1', name: 'First Org' },
          { id: 'org-2', name: 'Second Org' },
        ],
      },
    });

    vi.mocked(select).mockResolvedValue('org-2');

    await expect(getNeonOrganization(apiClient as never)).resolves.toBe('org-2');

    expect(select).toHaveBeenCalledWith({
      message: 'Select a Neon organization:',
      choices: [
        { name: 'First Org', value: 'org-1' },
        { name: 'Second Org', value: 'org-2' },
      ],
    });
  });

  it('propagates Neon organization API errors', async () => {
    apiClient.getCurrentUserOrganizations.mockRejectedValue(new Error('orgs failed'));

    await expect(getNeonOrganization(apiClient as never)).rejects.toThrow('orgs failed');

    expect(select).not.toHaveBeenCalled();
  });
});
