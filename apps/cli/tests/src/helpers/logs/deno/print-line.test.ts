import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { printLine } from '#helpers/logs/deno/print-line.ts';
import { printLog } from '#helpers/logs/print-log.ts';

vi.mock('#helpers/logs/print-log.ts', () => ({ printLog: vi.fn() }));

const logEntry = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    timestamp: '2026-07-27T12:00:00.123456789Z',
    level: 'info',
    message: 'hello world',
    revision_id: 'rev_1',
    region: 'us-east-1',
    trace_id: 'abc123def456',
    ...overrides,
  });

describe('deno printLine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints a parsed entry and returns its timestamp', () => {
    const result = printLine(logEntry(), '');

    expect(result).toBe('2026-07-27T12:00:00.123456789Z');
    expect(printLog).toHaveBeenCalledWith({
      timestampInMs: new Date('2026-07-27T12:00:00.123456789Z').getTime(),
      level: 'info',
      message: 'hello world',
      traceId: 'abc123def456',
    });
  });

  it('maps the warn level to warning', () => {
    printLine(logEntry({ level: 'warn' }), '');

    expect(printLog).toHaveBeenCalledWith(expect.objectContaining({ level: 'warning' }));
  });

  it('skips entries at or before the last printed timestamp', () => {
    const result = printLine(logEntry(), '2026-07-27T12:00:00.123456789Z');

    expect(result).toBe('2026-07-27T12:00:00.123456789Z');
    expect(printLog).not.toHaveBeenCalled();
  });

  it('prints entries older than the backfill window when nothing was printed yet', () => {
    printLine(logEntry({ timestamp: '2020-01-01T00:00:00.000000000Z' }), '');

    expect(printLog).toHaveBeenCalledOnce();
  });

  it('ignores empty lines', () => {
    expect(printLine('  \n', 'last')).toBe('last');
    expect(printLog).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
  });

  it('prints non-JSON lines as-is without touching the last printed timestamp', () => {
    expect(printLine('plain text line', 'last')).toBe('last');

    expect(console.log).toHaveBeenCalledWith('plain text line');
    expect(printLog).not.toHaveBeenCalled();
  });
});
