import path from 'node:path';

import { input, select } from '@inquirer/prompts';
import { createApiClient } from '@neondatabase/api-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getNeonOrganization } from '#helpers/db/neon/get-neon-organization.ts';
import { getNeonProject } from '#helpers/db/neon/get-neon-project.ts';
import { waitForDeployment } from '#helpers/db/neon/wait-for-deployment.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

const apiMocks = vi.hoisted(() => ({
  createProject: vi.fn(),
  listProjects: vi.fn(),
}));

vi.mock('@neondatabase/api-client', () => ({ createApiClient: vi.fn(() => apiMocks) }));
vi.mock('#helpers/db/neon/get-neon-organization.ts', () => ({ getNeonOrganization: vi.fn() }));
vi.mock('#helpers/db/neon/wait-for-deployment.ts', () => ({ waitForDeployment: vi.fn() }));

const readNeonConfig = (tmp: TempDir) => (JSON.parse(tmp.read('typebase.json')) as { neon?: unknown }).neon;

describe('getNeonProject', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();

    vi.clearAllMocks();
    vi.mocked(input).mockReset();
    vi.mocked(select).mockReset();
    vi.mocked(getNeonOrganization).mockResolvedValue('org-1');
    vi.mocked(waitForDeployment).mockResolvedValue(undefined);

    apiMocks.listProjects.mockResolvedValue({
      data: { projects: [] },
    });

    apiMocks.createProject.mockResolvedValue({
      data: {
        project: { id: 'created-project' },
        operations: [{ id: 'op-1' }],
      },
    });
  });

  afterEach(() => {
    tmp.cleanup();
    vi.restoreAllMocks();
  });

  it('returns the saved Neon config without creating an API client', async () => {
    tmp.write('typebase.json', JSON.stringify({ neon: { orgId: 'saved-org', projectId: 'saved-project' } }));

    const result = await withCwd(tmp.path, () => getNeonProject('neon-token'));

    expect(result).toEqual({ orgId: 'saved-org', projectId: 'saved-project' });
    expect(createApiClient).not.toHaveBeenCalled();
    expect(getNeonOrganization).not.toHaveBeenCalled();
    expect(apiMocks.listProjects).not.toHaveBeenCalled();
  });

  it('selects an existing project and saves it to typebase.json', async () => {
    tmp.write('typebase.json', '{}');

    apiMocks.listProjects.mockResolvedValue({
      data: {
        projects: [
          { id: 'project-1', name: 'First Project' },
          { id: 'project-2', name: 'Second Project' },
        ],
      },
    });

    vi.mocked(select).mockResolvedValue('project-2');

    const result = await withCwd(tmp.path, () => getNeonProject('neon-token'));

    expect(result).toEqual({ orgId: 'org-1', projectId: 'project-2' });
    expect(createApiClient).toHaveBeenCalledWith({ apiKey: 'neon-token' });
    expect(getNeonOrganization).toHaveBeenCalledWith(apiMocks);
    expect(apiMocks.listProjects).toHaveBeenCalledWith({ org_id: 'org-1' });

    expect(select).toHaveBeenCalledWith({
      message: 'Select a Neon project:',
      choices: [
        { name: '+ Create a new Neon project', value: '__create_new__' },
        { name: 'First Project', value: 'project-1' },
        { name: 'Second Project', value: 'project-2' },
      ],
    });

    expect(apiMocks.createProject).not.toHaveBeenCalled();
    expect(waitForDeployment).not.toHaveBeenCalled();
    expect(readNeonConfig(tmp)).toEqual({ orgId: 'org-1', projectId: 'project-2' });
  });

  it('lists projects without org scoping when no organization id is selected', async () => {
    tmp.write('typebase.json', '{}');

    vi.mocked(getNeonOrganization).mockResolvedValue('');

    apiMocks.listProjects.mockResolvedValue({
      data: {
        projects: [{ id: 'project-1', name: 'First Project' }],
      },
    });

    vi.mocked(select).mockResolvedValue('project-1');

    const result = await withCwd(tmp.path, () => getNeonProject('neon-token'));

    expect(result).toEqual({ orgId: '', projectId: 'project-1' });
    expect(apiMocks.listProjects).toHaveBeenCalledWith({});
    expect(readNeonConfig(tmp)).toEqual({ orgId: '', projectId: 'project-1' });
  });

  it('creates a new project when none exist, waits for Neon operations, and saves it', async () => {
    tmp.write('typebase.json', '{}');

    const operations = [{ id: 'op-1' }];

    vi.mocked(input).mockResolvedValue('fresh-project');
    vi.mocked(select).mockResolvedValue('aws-us-west-2');

    apiMocks.createProject.mockResolvedValue({
      data: {
        project: { id: 'created-project' },
        operations,
      },
    });

    const result = await withCwd(tmp.path, () => getNeonProject('neon-token'));

    expect(result).toEqual({ orgId: 'org-1', projectId: 'created-project' });
    expect(input).toHaveBeenCalledOnce();
    expect(vi.mocked(input).mock.calls[0]?.[0].message).toBe('Neon project name:');
    expect(vi.mocked(input).mock.calls[0]?.[0].default).toBe(path.basename(tmp.path));
    expect(vi.mocked(input).mock.calls[0]?.[0].prefill).toBe('editable');
    expect(vi.mocked(input).mock.calls[0]?.[0].required).toBe(true);

    expect(select).toHaveBeenCalledWith({
      message: 'Select a Neon region:',
      choices: [
        { name: 'US East (Ohio)', value: 'aws-us-east-2' },
        { name: 'US East (N. Virginia)', value: 'aws-us-east-1' },
        { name: 'US West (Oregon)', value: 'aws-us-west-2' },
        { name: 'Europe (Frankfurt)', value: 'aws-eu-central-1' },
        { name: 'Asia Pacific (Singapore)', value: 'aws-ap-southeast-1' },
        { name: 'Asia Pacific (Sydney)', value: 'aws-ap-southeast-2' },
      ],
    });

    expect(apiMocks.createProject).toHaveBeenCalledWith({
      project: {
        name: 'fresh-project',
        org_id: 'org-1',
        region_id: 'aws-us-west-2',
      },
    });

    expect(waitForDeployment).toHaveBeenCalledWith({ apiClient: apiMocks, projectId: 'created-project', operations });
    expect(readNeonConfig(tmp)).toEqual({ orgId: 'org-1', projectId: 'created-project' });

    const validate = vi.mocked(input).mock.calls[0]?.[0].validate;

    expect(validate?.('   ')).toBe(false);
    expect(validate?.('project')).toBe(true);
  });

  it('creates a new project when the create option is selected from an existing project list', async () => {
    tmp.write('typebase.json', '{}');

    apiMocks.listProjects.mockResolvedValue({
      data: {
        projects: [{ id: 'project-1', name: 'First Project' }],
      },
    });

    vi.mocked(input).mockResolvedValue('fresh-project');
    vi.mocked(select).mockResolvedValueOnce('__create_new__').mockResolvedValueOnce('aws-eu-central-1');

    await expect(withCwd(tmp.path, () => getNeonProject('neon-token'))).resolves.toEqual({
      orgId: 'org-1',
      projectId: 'created-project',
    });

    expect(apiMocks.createProject).toHaveBeenCalledWith({
      project: {
        name: 'fresh-project',
        org_id: 'org-1',
        region_id: 'aws-eu-central-1',
      },
    });
  });

  it('propagates project listing errors without saving config', async () => {
    tmp.write('typebase.json', '{}');

    apiMocks.listProjects.mockRejectedValue(new Error('projects failed'));

    await expect(withCwd(tmp.path, () => getNeonProject('neon-token'))).rejects.toThrow('projects failed');

    expect(apiMocks.createProject).not.toHaveBeenCalled();
    expect(readNeonConfig(tmp)).toBeUndefined();
  });

  it('propagates project creation errors without waiting or saving config', async () => {
    tmp.write('typebase.json', '{}');

    vi.mocked(input).mockResolvedValue('fresh-project');
    vi.mocked(select).mockResolvedValue('aws-us-east-2');

    apiMocks.createProject.mockRejectedValue(new Error('create failed'));

    await expect(withCwd(tmp.path, () => getNeonProject('neon-token'))).rejects.toThrow('create failed');

    expect(waitForDeployment).not.toHaveBeenCalled();
    expect(readNeonConfig(tmp)).toBeUndefined();
  });

  it('propagates deployment wait errors without saving config', async () => {
    tmp.write('typebase.json', '{}');

    vi.mocked(input).mockResolvedValue('fresh-project');
    vi.mocked(select).mockResolvedValue('aws-us-east-2');
    vi.mocked(waitForDeployment).mockRejectedValue(new Error('operation failed'));

    await expect(withCwd(tmp.path, () => getNeonProject('neon-token'))).rejects.toThrow('operation failed');

    expect(readNeonConfig(tmp)).toBeUndefined();
  });
});
