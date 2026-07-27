import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { printMessage } from '#helpers/logs/cloudflare/print-message.ts';
import { printLog } from '#helpers/logs/print-log.ts';

vi.mock('#helpers/logs/print-log.ts', () => ({ printLog: vi.fn() }));

const message = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    outcome: 'ok',
    eventTimestamp: 1_785_158_289_292,
    event: {
      request: { url: 'https://my-worker.acme.workers.dev/rpc/queries/feed/get?page=2', method: 'POST' },
      response: { status: 200 },
    },
    logs: [],
    exceptions: [],
    ...overrides,
  });

describe('cloudflare printMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints the request with only the path and its status', () => {
    printMessage(message());

    expect(printLog).toHaveBeenCalledWith({
      timestampInMs: 1_785_158_289_292,
      level: 'info',
      message: '',
      requestMethod: 'POST',
      requestPath: '/rpc/queries/feed/get?page=2',
      responseStatusCode: 200,
    });
  });

  it('decodes binary frames', () => {
    printMessage(new TextEncoder().encode(message()).buffer as ArrayBuffer);

    expect(printLog).toHaveBeenCalledWith(expect.objectContaining({ requestPath: '/rpc/queries/feed/get?page=2' }));
  });

  it('marks a failed invocation with its outcome', () => {
    printMessage(message({ outcome: 'exception' }));

    expect(printLog).toHaveBeenCalledWith(expect.objectContaining({ level: 'error', message: 'exception' }));
  });

  it('prints every console line of the invocation after the request', () => {
    printMessage(
      message({
        logs: [
          { message: ['first'], level: 'log', timestamp: 1 },
          { message: ['second'], level: 'info', timestamp: 2 },
        ],
      })
    );

    expect(printLog).toHaveBeenCalledTimes(3);
    expect(printLog).toHaveBeenNthCalledWith(2, { timestampInMs: 1, level: 'info', message: 'first' });
    expect(printLog).toHaveBeenNthCalledWith(3, { timestampInMs: 2, level: 'info', message: 'second' });
  });

  it('joins multi-argument console calls and serializes non-strings', () => {
    printMessage(message({ logs: [{ message: ['count:', 42, { a: 1 }], level: 'info', timestamp: 1 }] }));

    expect(printLog).toHaveBeenNthCalledWith(2, expect.objectContaining({ message: 'count: 42 {"a":1}' }));
  });

  it('maps the warn level to warning', () => {
    printMessage(message({ logs: [{ message: ['careful'], level: 'warn', timestamp: 1 }] }));

    expect(printLog).toHaveBeenNthCalledWith(2, expect.objectContaining({ level: 'warning' }));
  });

  it('prints an invocation that carries no logs or exceptions at all', () => {
    printMessage(JSON.stringify({ outcome: 'ok', eventTimestamp: 1, event: { request: { url: 'https://w.dev/', method: 'GET' } } }));

    expect(printLog).toHaveBeenCalledOnce();
    expect(printLog).toHaveBeenCalledWith(expect.objectContaining({ requestPath: '/' }));
  });

  it('serializes a structured exception message and omits a missing stack', () => {
    printMessage(message({ exceptions: [{ name: 'Error', message: { code: 'E_FAIL' }, timestamp: 5 }] }));

    expect(printLog).toHaveBeenNthCalledWith(2, { timestampInMs: 5, level: 'error', message: 'Error: {"code":"E_FAIL"}' });
  });

  it('prints exceptions with their stack', () => {
    printMessage(message({ exceptions: [{ name: 'Error', message: 'boom', timestamp: 5, stack: 'at handler' }] }));

    expect(printLog).toHaveBeenNthCalledWith(2, { timestampInMs: 5, level: 'error', message: 'Error: boom\nat handler' });
  });

  it('prints logs of invocations that have no request event', () => {
    printMessage(message({ event: null, logs: [{ message: ['cron ran'], level: 'info', timestamp: 1 }] }));

    expect(printLog).toHaveBeenCalledOnce();
    expect(printLog).toHaveBeenCalledWith(expect.objectContaining({ message: 'cron ran' }));
  });

  it('ignores empty frames and prints non-JSON frames as-is', () => {
    printMessage('   ');

    expect(printLog).not.toHaveBeenCalled();

    printMessage('not json');

    expect(console.log).toHaveBeenCalledWith('not json');
    expect(printLog).not.toHaveBeenCalled();
  });
});
