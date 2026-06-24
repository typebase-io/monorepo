import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { assignAlias } from '#helpers/deploy/vercel/assign-alias.ts';
import { VercelClient } from '#helpers/deploy/vercel/client.ts';
import { deployPlaceholder } from '#helpers/deploy/vercel/deploy-placeholder.ts';
import { deploy } from '#helpers/deploy/vercel/deploy.ts';
import { getVercelProject } from '#helpers/deploy/vercel/get-vercel-project.ts';
import { getVercelToken } from '#helpers/deploy/vercel/get-vercel-token.ts';
import { vercel } from '#helpers/deploy/vercel/index.ts';
import { waitForDeployment } from '#helpers/deploy/vercel/wait-for-deployment.ts';

const clientMocks = vi.hoisted(() => ({
  addEnvVariable: vi.fn(),
  hasAnyDeployment: vi.fn(),
}));

vi.mock('#helpers/deploy/vercel/assign-alias.ts', () => ({ assignAlias: vi.fn() }));
vi.mock('#helpers/deploy/vercel/deploy-placeholder.ts', () => ({ deployPlaceholder: vi.fn() }));
vi.mock('#helpers/deploy/vercel/deploy.ts', () => ({ deploy: vi.fn() }));
vi.mock('#helpers/deploy/vercel/get-vercel-project.ts', () => ({ getVercelProject: vi.fn() }));
vi.mock('#helpers/deploy/vercel/get-vercel-token.ts', () => ({ getVercelToken: vi.fn() }));
vi.mock('#helpers/deploy/vercel/wait-for-deployment.ts', () => ({ waitForDeployment: vi.fn() }));
vi.mock('#helpers/deploy/vercel/client.ts', () => ({
  VercelClient: vi.fn(function () {
    return {
      addEnvVariable: clientMocks.addEnvVariable,
      hasAnyDeployment: clientMocks.hasAnyDeployment,
    };
  }),
}));

describe('vercel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    vi.mocked(getVercelToken).mockResolvedValue('vercel-token');
    vi.mocked(getVercelProject).mockResolvedValue({ projectId: 'prj_1', projectName: 'my-project', orgId: 'team-1' });
    vi.mocked(deploy).mockResolvedValue({ deploymentId: 'dpl_1', url: 'my-project.vercel.app' });
    vi.mocked(assignAlias).mockResolvedValue('my-project-dev.vercel.app');
    vi.mocked(waitForDeployment).mockResolvedValue(undefined);
    vi.mocked(deployPlaceholder).mockResolvedValue(undefined);
    clientMocks.addEnvVariable.mockResolvedValue(undefined);
    clientMocks.hasAnyDeployment.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a placeholder deployment only for the first dev deployment', async () => {
    clientMocks.hasAnyDeployment.mockResolvedValue(false);

    await vercel({ serverDirPath: '/srv', target: 'dev', env: [] });

    expect(clientMocks.hasAnyDeployment).toHaveBeenCalledWith({ projectId: 'prj_1' });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Warning: this is the first deployment for this Vercel project.'));
    expect(deployPlaceholder).toHaveBeenCalledWith({ token: 'vercel-token', projectName: 'my-project', orgId: 'team-1' });
    expect(clientMocks.hasAnyDeployment).toHaveBeenCalledBefore(vi.mocked(deployPlaceholder));
    expect(deployPlaceholder).toHaveBeenCalledBefore(vi.mocked(deploy));
  });

  it('does not create a placeholder for prod deployments', async () => {
    await vercel({ serverDirPath: '/srv', target: 'prod', env: [] });

    expect(clientMocks.hasAnyDeployment).not.toHaveBeenCalled();
    expect(deployPlaceholder).not.toHaveBeenCalled();
  });

  it('does not create a placeholder when a dev deployment already exists', async () => {
    clientMocks.hasAnyDeployment.mockResolvedValue(true);

    await vercel({ serverDirPath: '/srv', target: 'dev', env: [] });

    expect(clientMocks.hasAnyDeployment).toHaveBeenCalledWith({ projectId: 'prj_1' });
    expect(deployPlaceholder).not.toHaveBeenCalled();
  });

  it('adds env vars only when env vars are provided and before deploying', async () => {
    await vercel({
      serverDirPath: '/srv',
      target: 'dev',
      env: [
        { key: 'SECRET_KEY', value: 'secret', secret: true },
        { key: 'PUBLIC_KEY', value: 'public', secret: false },
      ],
    });

    expect(clientMocks.addEnvVariable).toHaveBeenCalledTimes(2);

    expect(clientMocks.addEnvVariable).toHaveBeenNthCalledWith(1, {
      projectId: 'prj_1',
      key: 'SECRET_KEY',
      value: 'secret',
      encrypted: true,
      target: 'dev',
    });

    expect(clientMocks.addEnvVariable).toHaveBeenNthCalledWith(2, {
      projectId: 'prj_1',
      key: 'PUBLIC_KEY',
      value: 'public',
      encrypted: false,
      target: 'dev',
    });

    expect(clientMocks.addEnvVariable).toHaveBeenCalledBefore(vi.mocked(deploy));

    vi.clearAllMocks();
    vi.mocked(getVercelToken).mockResolvedValue('vercel-token');
    vi.mocked(getVercelProject).mockResolvedValue({ projectId: 'prj_1', projectName: 'my-project', orgId: 'team-1' });
    vi.mocked(deploy).mockResolvedValue({ deploymentId: 'dpl_1', url: 'my-project.vercel.app' });
    vi.mocked(assignAlias).mockResolvedValue('my-project-prod.vercel.app');
    vi.mocked(waitForDeployment).mockResolvedValue(undefined);

    await vercel({ serverDirPath: '/srv', target: 'prod', env: [] });

    expect(clientMocks.addEnvVariable).not.toHaveBeenCalled();
  });

  it('deploys, waits for the deployment, assigns the alias, and returns the alias URL', async () => {
    vi.mocked(assignAlias).mockResolvedValue('my-project-prod.vercel.app');

    const result = await vercel({ serverDirPath: '/srv', target: 'prod', env: [] });

    expect(result).toEqual({ deploymentId: 'dpl_1', url: 'https://my-project-prod.vercel.app' });
    expect(getVercelToken).toHaveBeenCalledOnce();
    expect(getVercelProject).toHaveBeenCalledWith('vercel-token');
    expect(VercelClient).toHaveBeenCalledWith({ token: 'vercel-token', orgId: 'team-1' });
    expect(deploy).toHaveBeenCalledWith({ token: 'vercel-token', projectName: 'my-project', orgId: 'team-1', serverDirPath: '/srv', target: 'prod' });
    expect(waitForDeployment).toHaveBeenCalledWith({ token: 'vercel-token', deploymentId: 'dpl_1', orgId: 'team-1', type: 'normal' });
    expect(assignAlias).toHaveBeenCalledWith({ token: 'vercel-token', deploymentId: 'dpl_1', projectId: 'prj_1', orgId: 'team-1', target: 'prod' });
    expect(deploy).toHaveBeenCalledBefore(vi.mocked(waitForDeployment));
    expect(waitForDeployment).toHaveBeenCalledBefore(vi.mocked(assignAlias));
  });

  it('stops when checking existing dev deployments fails', async () => {
    clientMocks.hasAnyDeployment.mockRejectedValue(new Error('deployment lookup failed'));

    await expect(vercel({ serverDirPath: '/srv', target: 'dev', env: [] })).rejects.toThrow('deployment lookup failed');

    expect(deployPlaceholder).not.toHaveBeenCalled();
    expect(clientMocks.addEnvVariable).not.toHaveBeenCalled();
    expect(deploy).not.toHaveBeenCalled();
    expect(waitForDeployment).not.toHaveBeenCalled();
    expect(assignAlias).not.toHaveBeenCalled();
  });

  it('stops when placeholder deployment fails', async () => {
    clientMocks.hasAnyDeployment.mockResolvedValue(false);
    vi.mocked(deployPlaceholder).mockRejectedValue(new Error('placeholder failed'));

    await expect(vercel({ serverDirPath: '/srv', target: 'dev', env: [] })).rejects.toThrow('placeholder failed');

    expect(deploy).not.toHaveBeenCalled();
    expect(waitForDeployment).not.toHaveBeenCalled();
    expect(assignAlias).not.toHaveBeenCalled();
  });

  it('stops when adding env vars fails', async () => {
    clientMocks.addEnvVariable.mockRejectedValue(new Error('env failed'));

    await expect(vercel({ serverDirPath: '/srv', target: 'prod', env: [{ key: 'FOO', value: 'bar', secret: true }] })).rejects.toThrow('env failed');

    expect(deploy).not.toHaveBeenCalled();
    expect(waitForDeployment).not.toHaveBeenCalled();
    expect(assignAlias).not.toHaveBeenCalled();
  });

  it('stops when deploying fails', async () => {
    vi.mocked(deploy).mockRejectedValue(new Error('deploy failed'));

    await expect(vercel({ serverDirPath: '/srv', target: 'prod', env: [] })).rejects.toThrow('deploy failed');

    expect(waitForDeployment).not.toHaveBeenCalled();
    expect(assignAlias).not.toHaveBeenCalled();
  });

  it('stops when waiting for the deployment fails', async () => {
    vi.mocked(waitForDeployment).mockRejectedValue(new Error('wait failed'));

    await expect(vercel({ serverDirPath: '/srv', target: 'prod', env: [] })).rejects.toThrow('wait failed');

    expect(assignAlias).not.toHaveBeenCalled();
  });

  it('propagates alias assignment failures', async () => {
    vi.mocked(assignAlias).mockRejectedValue(new Error('alias failed'));

    await expect(vercel({ serverDirPath: '/srv', target: 'prod', env: [] })).rejects.toThrow('alias failed');

    expect(deploy).toHaveBeenCalledOnce();
    expect(waitForDeployment).toHaveBeenCalledOnce();
    expect(assignAlias).toHaveBeenCalledOnce();
  });
});
