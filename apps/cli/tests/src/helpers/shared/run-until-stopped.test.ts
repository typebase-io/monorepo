import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runUntilStopped } from '#helpers/shared/run-until-stopped.ts';

const createFakeStdin = () => {
  const handlers = new Map<string, ((data: Buffer) => void)[]>();

  return {
    isTTY: true,
    setRawMode: vi.fn(),
    resume: vi.fn(),
    pause: vi.fn(),
    on: vi.fn((event: string, handler: (data: Buffer) => void) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    }),
    off: vi.fn((event: string, handler: (data: Buffer) => void) => {
      handlers.set(
        event,
        (handlers.get(event) ?? []).filter((registered) => registered !== handler)
      );
    }),
    press: (key: string) => {
      for (const handler of handlers.get('data') ?? []) {
        handler(Buffer.from(key));
      }
    },
  };
};

const untilAborted = (signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();

      return;
    }

    signal.addEventListener('abort', () => {
      resolve();
    });
  });

describe('runUntilStopped', () => {
  let stdin: ReturnType<typeof createFakeStdin>;
  let originalStdin: PropertyDescriptor | undefined;

  beforeEach(() => {
    stdin = createFakeStdin();
    originalStdin = Object.getOwnPropertyDescriptor(process, 'stdin');

    Object.defineProperty(process, 'stdin', { value: stdin, configurable: true });
  });

  afterEach(() => {
    if (originalStdin) {
      Object.defineProperty(process, 'stdin', originalStdin);
    }

    vi.restoreAllMocks();
  });

  it('resolves when the task finishes on its own', async () => {
    const run = vi.fn().mockResolvedValue(undefined);

    await runUntilStopped(run);

    expect(run).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it.each([
    { name: '"x"', key: 'x' },
    { name: '"X"', key: 'X' },
    { name: 'Ctrl+C', key: '\u0003' },
  ])('aborts the task when $name is pressed', async ({ key }) => {
    let taskSignal: AbortSignal | undefined;

    const promise = runUntilStopped((signal) => {
      taskSignal = signal;

      return untilAborted(signal);
    });

    await vi.waitFor(() => {
      expect(taskSignal).toBeDefined();
    });

    stdin.press(key);
    await promise;

    expect(taskSignal?.aborted).toBe(true);
  });

  it('keeps running when another key is pressed', async () => {
    let taskSignal: AbortSignal | undefined;

    const promise = runUntilStopped((signal) => {
      taskSignal = signal;

      return untilAborted(signal);
    });

    await vi.waitFor(() => {
      expect(taskSignal).toBeDefined();
    });

    stdin.press('a');

    expect(taskSignal?.aborted).toBe(false);

    stdin.press('x');
    await promise;
  });

  it('aborts the task on SIGINT', async () => {
    const onSpy = vi.spyOn(process, 'on');

    let taskSignal: AbortSignal | undefined;

    const promise = runUntilStopped((signal) => {
      taskSignal = signal;

      return untilAborted(signal);
    });

    await vi.waitFor(() => {
      expect(taskSignal).toBeDefined();
    });

    const onSigint = onSpy.mock.calls.find(([event]) => event === 'SIGINT')?.[1];

    onSigint?.();
    await promise;

    expect(taskSignal?.aborted).toBe(true);
  });

  it('puts the terminal in raw mode while running and restores it afterwards', async () => {
    const promise = runUntilStopped(untilAborted);

    await vi.waitFor(() => {
      expect(stdin.on).toHaveBeenCalledWith('data', expect.any(Function));
    });

    expect(stdin.setRawMode).toHaveBeenCalledWith(true);
    expect(stdin.resume).toHaveBeenCalledOnce();

    stdin.press('x');
    await promise;

    expect(stdin.setRawMode).toHaveBeenLastCalledWith(false);
    expect(stdin.off).toHaveBeenCalledWith('data', expect.any(Function));
    expect(stdin.pause).toHaveBeenCalledOnce();
  });

  it('restores the terminal when the task fails, and rethrows', async () => {
    await expect(runUntilStopped(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');

    expect(stdin.setRawMode).toHaveBeenLastCalledWith(false);
    expect(stdin.pause).toHaveBeenCalledOnce();
  });

  it('stops listening on the process once the task ends', async () => {
    const sigintBefore = process.listenerCount('SIGINT');
    const exitBefore = process.listenerCount('exit');

    await runUntilStopped(() => Promise.resolve());

    expect(process.listenerCount('SIGINT')).toBe(sigintBefore);
    expect(process.listenerCount('exit')).toBe(exitBefore);
  });

  it('leaves a non-interactive stdin untouched', async () => {
    Object.defineProperty(process, 'stdin', { value: { ...stdin, isTTY: false }, configurable: true });

    await runUntilStopped(() => Promise.resolve());

    expect(stdin.setRawMode).not.toHaveBeenCalled();
    expect(stdin.on).not.toHaveBeenCalled();
    expect(stdin.pause).not.toHaveBeenCalled();
  });
});
