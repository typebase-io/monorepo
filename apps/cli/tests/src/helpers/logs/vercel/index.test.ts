import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VercelClient } from '#helpers/deploy/vercel/client.ts';
import { getVercelProject } from '#helpers/deploy/vercel/get-vercel-project.ts';
import { getVercelToken } from '#helpers/deploy/vercel/get-vercel-token.ts';
import { streamVercelLogs } from '#helpers/logs/vercel/index.ts';
import { printLine } from '#helpers/logs/vercel/print-line.ts';

const clientMocks = vi.hoisted(() => ({
  getDeployment: vi.fn(),
  getRequestLogs: vi.fn(),
}));

vi.mock('#helpers/deploy/vercel/get-vercel-project.ts', () => ({ getVercelProject: vi.fn() }));
vi.mock('#helpers/deploy/vercel/get-vercel-token.ts', () => ({ getVercelToken: vi.fn() }));
vi.mock('#helpers/logs/vercel/print-line.ts', () => ({ printLine: vi.fn() }));
vi.mock('#helpers/deploy/vercel/client.ts', () => ({
  VercelClient: vi.fn(function () {
    return clientMocks;
  }),
}));

const row = (overrides: Record<string, unknown> = {}) => ({
  requestId: 'req_1',
  timestamp: '2026-07-27T12:00:00.000Z',
  requestMethod: 'GET',
  requestPath: '/api/todos',
  statusCode: 200,
  logs: [{ level: 'info', message: 'hello world' }],
  ...overrides,
});

describe('streamVercelLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getVercelToken).mockResolvedValue('vercel-token');
    vi.mocked(getVercelProject).mockResolvedValue({ projectId: 'prj_1', projectName: 'my-project', orgId: 'team-1' });
    clientMocks.getDeployment.mockResolvedValue({ id: 'dpl_1', readyState: 'READY' });
    clientMocks.getRequestLogs.mockResolvedValue([]);
  });

  afterEach(() => {
    process.exitCode = 0;
    vi.restoreAllMocks();
  });

  it('resolves the aliased deployment and prints the polled rows', async () => {
    const abort = new AbortController();

    clientMocks.getRequestLogs.mockImplementation(() => {
      abort.abort();

      return Promise.resolve([row()]);
    });

    await streamVercelLogs({ target: 'dev', signal: abort.signal });

    expect(getVercelToken).toHaveBeenCalledOnce();
    expect(getVercelProject).toHaveBeenCalledWith('vercel-token');
    expect(VercelClient).toHaveBeenCalledWith({ token: 'vercel-token', orgId: 'team-1' });
    expect(clientMocks.getDeployment).toHaveBeenCalledWith({ idOrUrl: 'prj-1-dev.vercel.app' });

    expect(clientMocks.getRequestLogs).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'prj_1', deploymentId: 'dpl_1', signal: abort.signal })
    );

    const { startDate, endDate } = clientMocks.getRequestLogs.mock.calls[0]?.[0] as { startDate: number; endDate: number };

    expect(startDate).toBeLessThan(endDate);
    expect(printLine).toHaveBeenCalledWith(row());
  });

  it('uses the prod alias', async () => {
    const abort = new AbortController();

    clientMocks.getRequestLogs.mockImplementation(() => {
      abort.abort();

      return Promise.resolve([]);
    });

    await streamVercelLogs({ target: 'prod', signal: abort.signal });

    expect(clientMocks.getDeployment).toHaveBeenCalledWith({ idOrUrl: 'prj-1-prod.vercel.app' });
  });

  it('polls repeatedly, prints rows oldest first, and dedupes rows already printed', async () => {
    const abort = new AbortController();
    let polls = 0;

    const newer = row({ requestId: 'req_2', timestamp: '2026-07-27T12:00:02.000Z' });
    const older = row({ requestId: 'req_3', timestamp: '2026-07-27T12:00:01.000Z' });

    clientMocks.getRequestLogs.mockImplementation(() => {
      polls++;

      if (polls === 2) {
        abort.abort();

        return Promise.resolve([row(), newer, older]);
      }

      return Promise.resolve([row()]);
    });

    await streamVercelLogs({ target: 'dev', signal: abort.signal });

    expect(polls).toBe(2);
    expect(printLine).toHaveBeenCalledTimes(3);
    expect(printLine).toHaveBeenNthCalledWith(1, row());
    expect(printLine).toHaveBeenNthCalledWith(2, older);
    expect(printLine).toHaveBeenNthCalledWith(3, newer);
  });

  it('dedupes and orders rows that carry neither a request id nor a timestamp', async () => {
    const abort = new AbortController();
    const anonymous = [
      { requestMethod: 'GET', requestPath: '/api/todos', statusCode: 200, logs: [] },
      { requestMethod: 'POST', requestPath: '/api/todos', statusCode: 201, logs: [] },
    ];

    let polls = 0;

    clientMocks.getRequestLogs.mockImplementation(() => {
      polls++;

      if (polls === 2) {
        abort.abort();
      }

      return Promise.resolve(anonymous);
    });

    await streamVercelLogs({ target: 'dev', signal: abort.signal });

    expect(polls).toBe(2);
    expect(printLine).toHaveBeenCalledTimes(2);
  });

  it('stops quietly when the poll is cancelled by the abort', async () => {
    const abort = new AbortController();

    clientMocks.getRequestLogs.mockImplementation(() => {
      abort.abort();

      return Promise.reject(new Error('This operation was aborted'));
    });

    await expect(streamVercelLogs({ target: 'dev', signal: abort.signal })).resolves.toBeUndefined();
  });

  it('forgets the oldest requests once the dedupe list is full', async () => {
    const abort = new AbortController();
    const oldest = row({ requestId: 'req_0', timestamp: '2026-07-27T12:00:00.000Z' });

    const flood = [oldest, ...Array.from({ length: 5_000 }, (_, index) => row({ requestId: `req_${index + 1}` }))];
    let polls = 0;

    clientMocks.getRequestLogs.mockImplementation(() => {
      polls++;

      if (polls === 1) {
        return Promise.resolve(flood);
      }

      abort.abort();

      return Promise.resolve([oldest]);
    });

    await streamVercelLogs({ target: 'dev', signal: abort.signal });

    expect(printLine).toHaveBeenCalledTimes(flood.length + 1);
    expect(vi.mocked(printLine).mock.calls.filter(([printed]) => printed.requestId === 'req_0')).toHaveLength(2);
  });

  it('fails without polling when there is no deployment for the target', async () => {
    clientMocks.getDeployment.mockResolvedValue(undefined);

    await streamVercelLogs({ target: 'prod', signal: new AbortController().signal });

    expect(process.exitCode).toBe(1);
    expect(clientMocks.getRequestLogs).not.toHaveBeenCalled();
  });

  it('throws when the deployment lookup fails', async () => {
    clientMocks.getDeployment.mockRejectedValue(new Error('lookup failed'));

    await expect(streamVercelLogs({ target: 'dev', signal: new AbortController().signal })).rejects.toThrow('lookup failed');
  });

  it('throws when polling the request logs fails', async () => {
    clientMocks.getRequestLogs.mockRejectedValue(new Error('logs failed'));

    await expect(streamVercelLogs({ target: 'dev', signal: new AbortController().signal })).rejects.toThrow('logs failed');
  });

  it('propagates project lookup errors without creating a client', async () => {
    vi.mocked(getVercelProject).mockRejectedValue(new Error('project failed'));

    await expect(streamVercelLogs({ target: 'prod', signal: new AbortController().signal })).rejects.toThrow('project failed');

    expect(VercelClient).not.toHaveBeenCalled();
  });
});
