import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getDenoProject } from '#helpers/deploy/deno/get-deno-project.ts';
import { getDenoToken } from '#helpers/deploy/deno/get-deno-token.ts';
import { findTargetRevision } from '#helpers/logs/deno/find-target-revision.ts';
import { streamDenoLogs } from '#helpers/logs/deno/index.ts';
import { printLine } from '#helpers/logs/deno/print-line.ts';

import { mockFetch } from '#tests/helpers/mock-fetch.ts';

vi.mock('#helpers/deploy/deno/get-deno-project.ts', () => ({ getDenoProject: vi.fn() }));
vi.mock('#helpers/deploy/deno/get-deno-token.ts', () => ({ getDenoToken: vi.fn() }));
vi.mock('#helpers/logs/deno/find-target-revision.ts', () => ({ findTargetRevision: vi.fn() }));
vi.mock('#helpers/logs/deno/print-line.ts', () => ({ printLine: vi.fn() }));

const encoder = new TextEncoder();

const ndjsonStream = (lines: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(`${line}\n`));
      }

      controller.close();
    },
  });

describe('streamDenoLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDenoToken).mockResolvedValue('deno-token');
    vi.mocked(getDenoProject).mockResolvedValue({ org: 'my-org', projectId: 'app-1', slug: 'my-app' });
    vi.mocked(findTargetRevision).mockResolvedValue('rev_1');
    vi.mocked(printLine).mockImplementation((_line, lastPrinted) => lastPrinted);
  });

  afterEach(() => {
    process.exitCode = 0;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('resolves the target revision and streams its logs line by line', async () => {
    const abort = new AbortController();

    const { calls } = mockFetch(() => {
      abort.abort();

      return { body: ndjsonStream(['line one', 'line two']) };
    });

    await streamDenoLogs({ target: 'prod', signal: abort.signal });

    expect(getDenoToken).toHaveBeenCalledOnce();
    expect(getDenoProject).toHaveBeenCalledWith('deno-token');
    expect(findTargetRevision).toHaveBeenCalledWith({ token: 'deno-token', projectId: 'app-1', target: 'prod' });

    const logsUrl = new URL(calls[0]?.url ?? '');

    expect(`${logsUrl.origin}${logsUrl.pathname}`).toBe('https://api.deno.com/v2/apps/app-1/logs');
    expect(logsUrl.searchParams.get('revision_id')).toBe('rev_1');
    expect(logsUrl.searchParams.get('start')).toBeTruthy();
    expect(calls[0]?.headers).toEqual({ Authorization: 'Bearer deno-token', Accept: 'application/x-ndjson' });

    expect(printLine).toHaveBeenCalledWith('line one', '');
    expect(printLine).toHaveBeenCalledWith('line two', '');
  });

  it('passes the dev target through to the revision lookup', async () => {
    const abort = new AbortController();

    mockFetch(() => {
      abort.abort();

      return { body: ndjsonStream([]) };
    });

    await streamDenoLogs({ target: 'dev', signal: abort.signal });

    expect(findTargetRevision).toHaveBeenCalledWith({ token: 'deno-token', projectId: 'app-1', target: 'dev' });
  });

  it('reconnects when the stream ends and resumes from the last printed timestamp', async () => {
    const abort = new AbortController();
    let streamCalls = 0;

    vi.mocked(printLine).mockReturnValue('2026-07-27T12:00:00.123456789Z');

    const { calls } = mockFetch(() => {
      streamCalls++;

      if (streamCalls === 2) {
        abort.abort();

        return { body: ndjsonStream([]) };
      }

      return { body: ndjsonStream(['an entry']) };
    });

    await streamDenoLogs({ target: 'prod', signal: abort.signal });

    expect(streamCalls).toBe(2);
    expect(new URL(calls[1]?.url ?? '').searchParams.get('start')).toBe('2026-07-27T12:00:00.123456789Z');
  });

  it('buffers a partial line until the rest of it arrives', async () => {
    const abort = new AbortController();

    mockFetch(() => {
      abort.abort();

      return {
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('{"timestamp":"1","level":"info","mes'));
            controller.enqueue(encoder.encode('sage":"split across chunks"}\n'));
            controller.close();
          },
        }),
      };
    });

    await streamDenoLogs({ target: 'prod', signal: abort.signal });

    expect(printLine).toHaveBeenCalledWith('{"timestamp":"1","level":"info","message":"split across chunks"}', '');
  });

  it('reconnects when the response carries no body', async () => {
    const abort = new AbortController();
    let streamCalls = 0;

    mockFetch(() => {
      streamCalls++;

      if (streamCalls === 2) {
        abort.abort();
      }

      return { body: null };
    });

    await streamDenoLogs({ target: 'prod', signal: abort.signal });

    expect(streamCalls).toBe(2);
    expect(printLine).not.toHaveBeenCalled();
  });

  it('stops quietly when the request is cancelled by the abort', async () => {
    const abort = new AbortController();

    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        abort.abort();

        return Promise.reject(new Error('This operation was aborted'));
      })
    );

    await expect(streamDenoLogs({ target: 'prod', signal: abort.signal })).resolves.toBeUndefined();
  });

  it('fails without streaming when no revision matches the target', async () => {
    vi.mocked(findTargetRevision).mockResolvedValue(undefined);

    const { calls } = mockFetch(() => ({}));

    await streamDenoLogs({ target: 'dev', signal: new AbortController().signal });

    expect(process.exitCode).toBe(1);
    expect(calls).toHaveLength(0);
  });

  it('throws when the logs request fails', async () => {
    mockFetch(() => ({ ok: false, text: 'logs unavailable' }));

    await expect(streamDenoLogs({ target: 'prod', signal: new AbortController().signal })).rejects.toThrow('logs unavailable');
  });

  it('propagates revision lookup errors without streaming', async () => {
    vi.mocked(findTargetRevision).mockRejectedValue(new Error('lookup failed'));

    const { calls } = mockFetch(() => ({}));

    await expect(streamDenoLogs({ target: 'prod', signal: new AbortController().signal })).rejects.toThrow('lookup failed');

    expect(calls).toHaveLength(0);
  });

  it('propagates project lookup errors without streaming', async () => {
    vi.mocked(getDenoProject).mockRejectedValue(new Error('project failed'));

    const { calls } = mockFetch(() => ({}));

    await expect(streamDenoLogs({ target: 'prod', signal: new AbortController().signal })).rejects.toThrow('project failed');

    expect(calls).toHaveLength(0);
  });
});
