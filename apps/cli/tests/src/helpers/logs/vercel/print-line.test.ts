import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { printLog } from '#helpers/logs/print-log.ts';
import { printLine } from '#helpers/logs/vercel/print-line.ts';

vi.mock('#helpers/logs/print-log.ts', () => ({ printLog: vi.fn() }));

describe('vercel printLine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints the request info with its console output', () => {
    printLine({
      requestId: 'req_1',
      timestamp: '2026-07-27T12:00:00.000Z',
      requestMethod: 'GET',
      requestPath: '/api/todos',
      statusCode: 200,
      logs: [{ level: 'info', message: 'hello world' }],
    });

    expect(printLog).toHaveBeenCalledWith({
      timestampInMs: new Date('2026-07-27T12:00:00.000Z').getTime(),
      level: 'info',
      message: 'hello world',
      requestMethod: 'GET',
      requestPath: '/api/todos',
      responseStatusCode: 200,
    });
  });

  it('shows the most severe console line of a request', () => {
    printLine({
      timestamp: '2026-07-27T12:00:00.000Z',
      logs: [
        { level: 'info', message: 'started' },
        { level: 'error', message: 'boom' },
        { level: 'warning', message: 'careful' },
      ],
    });

    expect(printLog).toHaveBeenCalledWith(expect.objectContaining({ level: 'error', message: 'boom' }));
  });

  it('treats entries without a level, and unknown levels, as the lowest severity', () => {
    printLine({
      timestamp: '2026-07-27T12:00:00.000Z',
      logs: [
        { level: 'trace', message: 'unknown level' },
        { level: 'verbose', message: 'another unknown level' },
        { message: 'no level' },
        { level: 'error', message: 'boom' },
      ],
    });

    expect(printLog).toHaveBeenCalledWith(expect.objectContaining({ level: 'error', message: 'boom' }));
  });

  it('keeps the first entry when none of them carry a level', () => {
    printLine({ timestamp: '2026-07-27T12:00:00.000Z', logs: [{ message: 'first' }, { message: 'second' }] });

    expect(printLog).toHaveBeenCalledWith(expect.objectContaining({ level: 'info', message: 'first' }));
  });

  it('defaults to an info level and empty message when the request produced no console output', () => {
    printLine({ timestamp: '2026-07-27T12:00:00.000Z', requestMethod: 'POST', requestPath: '/api', statusCode: 500 });

    expect(printLog).toHaveBeenCalledWith(expect.objectContaining({ level: 'info', message: '' }));
  });

  it('falls back to the current time when the row has no timestamp', () => {
    printLine({ logs: [{ level: 'info', message: 'no timestamp' }] });

    const { timestampInMs } = vi.mocked(printLog).mock.calls[0]?.[0] ?? {};

    expect(typeof timestampInMs).toBe('number');
    expect(Number.isNaN(timestampInMs)).toBe(false);
  });
});
