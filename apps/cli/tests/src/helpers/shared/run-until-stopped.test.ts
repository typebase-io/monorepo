import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runUntilStopped } from '#helpers/shared/run-until-stopped.ts';

const createFakeStdin = () => {
  const handlers = new Map<string, ((data: Buffer) => void)[]>();

  const stdin = {
    isTTY: true,
    isRaw: false,
    paused: true,
    setRawMode: vi.fn((value: boolean) => {
      stdin.isRaw = value;
    }),
    resume: vi.fn(() => {
      stdin.paused = false;
    }),
    pause: vi.fn(() => {
      stdin.paused = true;
    }),
    on: vi.fn((event: string, handler: (data: Buffer) => void) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    }),
    off: vi.fn((event: string, handler: (data: Buffer) => void) => {
      handlers.set(
        event,
        (handlers.get(event) ?? []).filter((registered) => registered !== handler)
      );
    }),
    listenerCount: (event: string) => (handlers.get(event) ?? []).length,
    press: (key: string) => {
      for (const handler of handlers.get('data') ?? []) {
        handler(Buffer.from(key));
      }
    },
  };

  return stdin;
};

const exitPromptError = () => Object.assign(new Error('User force closed the prompt with SIGINT'), { name: 'ExitPromptError' });

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

    expect(run).toHaveBeenCalledWith(expect.any(AbortSignal), expect.any(Function));
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

  describe('prompts', () => {
    const snapshot = () => ({ isRaw: stdin.isRaw, paused: stdin.paused, listeners: stdin.listenerCount('data') });

    let leaked: ((data: Buffer) => void) | undefined;

    const tearDownLikeTheLibrary = () => {
      stdin.setRawMode(false);
      stdin.pause();

      if (leaked) {
        stdin.off('data', leaked);
      }

      leaked = () => undefined;

      stdin.on('data', leaked);
    };

    const ask =
      <T>(answer: T) =>
      () => {
        tearDownLikeTheLibrary();

        return Promise.resolve(answer);
      };

    const askFailingWith = (error: Error) => () => {
      tearDownLikeTheLibrary();

      return Promise.reject(error);
    };

    beforeEach(() => {
      leaked = undefined;
    });

    it('hands stdin to the prompt and takes it back afterwards', async () => {
      let duringPrompt: ReturnType<typeof snapshot> | undefined;
      let afterPrompt: ReturnType<typeof snapshot> | undefined;
      let answer: string | undefined;

      await runUntilStopped(async (_signal, prompt) => {
        answer = await prompt(() => {
          duringPrompt = snapshot();

          return ask('yes')();
        });

        afterPrompt = snapshot();
      });

      expect(answer).toBe('yes');
      expect(duringPrompt).toEqual({ isRaw: false, paused: true, listeners: 0 });
      expect(afterPrompt).toEqual({ isRaw: true, paused: false, listeners: 2 });
    });

    it.each([
      { name: '"x"', key: 'x' },
      { name: 'Ctrl+C', key: '\u0003' },
    ])('stops the run when $name is pressed after a prompt has been answered', async ({ key }) => {
      let taskSignal: AbortSignal | undefined;
      let answered = false;

      const promise = runUntilStopped(async (signal, prompt) => {
        taskSignal = signal;

        await prompt(ask('yes'));

        answered = true;

        return untilAborted(signal);
      });

      await vi.waitFor(() => {
        expect(answered).toBe(true);
      });

      stdin.press(key);
      await promise;

      expect(taskSignal?.aborted).toBe(true);
    });

    it('stops the run on SIGINT after a prompt has been answered', async () => {
      const onSpy = vi.spyOn(process, 'on');

      let taskSignal: AbortSignal | undefined;
      let answered = false;

      const promise = runUntilStopped(async (signal, prompt) => {
        taskSignal = signal;

        await prompt(ask('yes'));

        answered = true;

        return untilAborted(signal);
      });

      await vi.waitFor(() => {
        expect(answered).toBe(true);
      });

      const onSigint = onSpy.mock.calls.find(([event]) => event === 'SIGINT')?.[1];

      onSigint?.();
      await promise;

      expect(taskSignal?.aborted).toBe(true);
    });

    it('does not accumulate listeners however many prompts run', async () => {
      const listeners: number[] = [];

      await runUntilStopped(async (_signal, prompt) => {
        for (const round of [1, 2, 3, 4, 5]) {
          await prompt(ask(round));

          listeners.push(stdin.listenerCount('data'));
        }
      });

      expect(listeners).toEqual([2, 2, 2, 2, 2]);
    });

    it('stops the run cleanly when the prompt is closed with Ctrl+C, without resolving it', async () => {
      let taskSignal: AbortSignal | undefined;
      let continuedAfterPrompt = false;

      await expect(
        runUntilStopped(async (signal, prompt) => {
          taskSignal = signal;

          await prompt(askFailingWith(exitPromptError()));

          continuedAfterPrompt = true;
        })
      ).resolves.toBeUndefined();

      expect(taskSignal?.aborted).toBe(true);
      expect(continuedAfterPrompt).toBe(false);
      expect(stdin.isRaw).toBe(false);
      expect(stdin.paused).toBe(true);
    });

    it('lets the run clean up after Ctrl+C at a prompt', async () => {
      const cleanedUp = vi.fn();

      await runUntilStopped(async (_signal, prompt) => {
        try {
          await prompt(askFailingWith(exitPromptError()));
        } finally {
          cleanedUp();
        }
      });

      expect(cleanedUp).toHaveBeenCalledOnce();
    });

    it('rethrows a prompt failure that is not a Ctrl+C', async () => {
      await expect(
        runUntilStopped(async (_signal, prompt) => {
          await prompt(askFailingWith(new Error('boom')));
        })
      ).rejects.toThrow('boom');

      expect(stdin.setRawMode).toHaveBeenLastCalledWith(false);
    });

    it('runs the prompt without touching a non-interactive stdin', async () => {
      Object.defineProperty(process, 'stdin', { value: { ...stdin, isTTY: false }, configurable: true });

      let answer: string | undefined;

      await runUntilStopped(async (_signal, prompt) => {
        answer = await prompt(() => Promise.resolve('yes'));
      });

      expect(answer).toBe('yes');
      expect(stdin.setRawMode).not.toHaveBeenCalled();
    });
  });
});
