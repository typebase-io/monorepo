import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { printLog } from '#helpers/logs/print-log.ts';

const logged = () => vi.mocked(console.log).mock.calls.flat().map(String).join('\n');

describe('printLog', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints the level, request info and message', () => {
    printLog({
      timestampInMs: Date.UTC(2026, 0, 1, 12, 34, 56),
      level: 'info',
      message: 'hello world',
      requestMethod: 'GET',
      requestPath: '/api/todos',
      responseStatusCode: 200,
    });

    expect(logged()).toContain('INFO');
    expect(logged()).toContain('GET /api/todos 200');
    expect(logged()).toContain('hello world');
  });

  it('omits the request info when there is none', () => {
    printLog({ timestampInMs: Date.UTC(2026, 0, 1), level: 'error', message: 'boom' });

    expect(logged()).toContain('ERROR');
    expect(logged()).toContain('boom');
    expect(logged()).not.toContain('undefined');
  });

  it('strips the trailing newline from the message', () => {
    printLog({ timestampInMs: Date.UTC(2026, 0, 1), level: 'info', message: 'no blank line after me\n' });

    expect(vi.mocked(console.log).mock.calls[0]?.[0]).not.toMatch(/\s$/);
  });

  it('prints a shortened trace id when provided', () => {
    printLog({ timestampInMs: Date.UTC(2026, 0, 1), level: 'info', message: 'traced', traceId: 'abc123def456789' });

    expect(logged()).toContain('[abc123de]');
    expect(logged()).not.toContain('abc123def456789');
  });

  it('omits non-positive status codes', () => {
    printLog({
      timestampInMs: Date.UTC(2026, 0, 1),
      level: 'warning',
      message: 'slow',
      requestMethod: 'POST',
      requestPath: '/api/todos',
      responseStatusCode: -1,
    });

    expect(logged()).toContain('POST /api/todos');
    expect(logged()).not.toContain('-1');
  });
});
