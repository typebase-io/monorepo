import type * as Chokidar from 'chokidar';
import { type FSWatcher } from 'chokidar';
import ora from 'ora';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { watchServer } from '#helpers/generate-server/watch-server.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

const DEBOUNCE_MS = 20;

const { watchers } = vi.hoisted(() => ({ watchers: [] as FSWatcher[] }));

vi.mock('chokidar', async (importOriginal) => {
  const actual = await importOriginal<typeof Chokidar>();

  const watch = (paths: string, options: Parameters<typeof actual.watch>[1]) => {
    const watcher = actual.watch(paths, options);

    watchers.push(watcher);

    return watcher;
  };

  return { ...actual, watch, default: { ...actual.default, watch } };
});

const createControllableBuild = () => {
  const started: AbortSignal[] = [];
  const finishers: (() => void)[] = [];

  const build = vi.fn((signal: AbortSignal) => {
    started.push(signal);

    return new Promise<void>((resolve, reject) => {
      finishers.push(resolve);

      signal.addEventListener('abort', () => {
        reject(signal.reason as Error);
      });
    });
  });

  return {
    build,
    started,
    finishLatest: () => finishers.at(-1)?.(),
  };
};

describe('watchServer', { retry: 2 }, () => {
  let tmp: TempDir;
  let controller: AbortController;

  const lastWatcher = () => watchers.at(-1);

  const watch = async (build: (signal: AbortSignal) => Promise<void>, debounceMs = DEBOUNCE_MS) => {
    await new Promise((resolve) => setTimeout(resolve, 80));

    return watchServer({ build, dirPath: tmp.path, signal: controller.signal, debounceMs });
  };

  beforeEach(() => {
    watchers.length = 0;
    tmp = createTempDir();
    tmp.mkdir('actions');
    controller = new AbortController();
  });

  afterEach(() => {
    controller.abort();
    tmp.cleanup();
  });

  it('builds once as soon as it starts', async () => {
    const build = vi.fn().mockResolvedValue(undefined);

    const watching = watch(build);

    await vi.waitFor(
      () => {
        expect(build).toHaveBeenCalledTimes(1);
      },
      { timeout: 15_000 }
    );

    controller.abort();
    await watching;
  });

  it('rebuilds when a file changes', async () => {
    const build = vi.fn().mockResolvedValue(undefined);

    const watching = watch(build);

    await vi.waitFor(
      () => {
        expect(build).toHaveBeenCalledTimes(1);
      },
      { timeout: 15_000 }
    );

    tmp.write('actions/todos.ts', 'export const a = 1;');

    await vi.waitFor(
      () => {
        expect(build).toHaveBeenCalledTimes(2);
      },
      { timeout: 15_000 }
    );

    controller.abort();
    await watching;
  });

  it('tells the builder which runs are rebuilds, so only the first one narrates', async () => {
    const build = vi.fn().mockResolvedValue(undefined);

    const watching = watch(build);

    await vi.waitFor(
      () => {
        expect(build).toHaveBeenCalledTimes(1);
      },
      { timeout: 15_000 }
    );

    expect(build).toHaveBeenNthCalledWith(1, expect.any(AbortSignal), { rebuild: false });

    tmp.write('actions/todos.ts', 'export const a = 1;');

    await vi.waitFor(
      () => {
        expect(build).toHaveBeenCalledTimes(2);
      },
      { timeout: 15_000 }
    );

    expect(build).toHaveBeenNthCalledWith(2, expect.any(AbortSignal), { rebuild: true });

    controller.abort();
    await watching;
  });

  it('cancels the running build and starts a new one when a file changes mid-build', async () => {
    const { build, started, finishLatest } = createControllableBuild();

    const watching = watch(build);

    await vi.waitFor(
      () => {
        expect(build).toHaveBeenCalledTimes(1);
      },
      { timeout: 15_000 }
    );

    tmp.write('actions/todos.ts', 'export const a = 1;');

    await vi.waitFor(
      () => {
        expect(started[0]?.aborted).toBe(true);
      },
      { timeout: 15_000 }
    );

    await vi.waitFor(
      () => {
        expect(build).toHaveBeenCalledTimes(2);
      },
      { timeout: 15_000 }
    );

    expect(started[1]?.aborted).toBe(false);

    finishLatest();
    controller.abort();
    await watching;
  });

  it('cancels the running build as soon as the first edit lands, without waiting out the debounce', async () => {
    const { build, started, finishLatest } = createControllableBuild();

    const LONG_DEBOUNCE_MS = 400;

    const watching = watch(build, LONG_DEBOUNCE_MS);

    await vi.waitFor(
      () => {
        expect(build).toHaveBeenCalledTimes(1);
      },
      { timeout: 15_000 }
    );

    const changedAt = Date.now();

    tmp.write('actions/todos.ts', 'export const a = 1;');

    await vi.waitFor(
      () => {
        expect(started[0]?.aborted).toBe(true);
      },
      { timeout: 15_000 }
    );

    expect(Date.now() - changedAt).toBeLessThan(LONG_DEBOUNCE_MS);
    expect(build).toHaveBeenCalledTimes(1);

    finishLatest();
    controller.abort();
    await watching;
  });

  it('rebuilds once for a burst of edits', async () => {
    const build = vi.fn().mockResolvedValue(undefined);

    const BURST_DEBOUNCE_MS = 300;

    const watching = watch(build, BURST_DEBOUNCE_MS);

    await vi.waitFor(
      () => {
        expect(build).toHaveBeenCalledTimes(1);
      },
      { timeout: 15_000 }
    );

    tmp.write('actions/one.ts', 'export const a = 1;');
    tmp.write('actions/two.ts', 'export const b = 2;');
    tmp.write('actions/three.ts', 'export const c = 3;');

    await vi.waitFor(
      () => {
        expect(build).toHaveBeenCalledTimes(2);
      },
      { timeout: 15_000 }
    );

    await new Promise((resolve) => setTimeout(resolve, BURST_DEBOUNCE_MS + 200));

    expect(build).toHaveBeenCalledTimes(2);

    controller.abort();
    await watching;
  });

  it('stops cleanly when it is stopped before the watcher finished starting up', async () => {
    const build = vi.fn().mockResolvedValue(undefined);

    await new Promise((resolve) => setTimeout(resolve, 80));

    const watching = watchServer({ build, dirPath: tmp.path, signal: controller.signal, debounceMs: DEBOUNCE_MS });

    controller.abort();

    await expect(watching).resolves.toBeUndefined();
  });

  it('does nothing when it is handed a signal that already aborted', async () => {
    const build = vi.fn().mockResolvedValue(undefined);

    controller.abort();

    await expect(watch(build)).resolves.toBeUndefined();

    expect(build).not.toHaveBeenCalled();
  });

  it('ignores a change that lands between stopping and the watcher closing', async () => {
    const build = vi.fn().mockResolvedValue(undefined);

    const watching = watch(build);

    await vi.waitFor(
      () => {
        expect(build).toHaveBeenCalledTimes(1);
      },
      { timeout: 15_000 }
    );

    controller.abort();
    lastWatcher()?.emit('all', 'change', 'actions/todos.ts');

    await watching;

    expect(build).toHaveBeenCalledTimes(1);
  });

  it('stops with a clear error when the watcher itself fails', async () => {
    const build = vi.fn().mockResolvedValue(undefined);

    const watching = watch(build);

    await vi.waitFor(
      () => {
        expect(build).toHaveBeenCalledTimes(1);
      },
      { timeout: 15_000 }
    );

    lastWatcher()?.emit('error', new Error('EMFILE: too many open files'));

    await expect(watching).rejects.toThrow('EMFILE: too many open files');
  });

  it('cancels a build in flight when the watcher fails, instead of waiting for it forever', async () => {
    const { build, started } = createControllableBuild();

    const watching = watch(build);

    await vi.waitFor(
      () => {
        expect(build).toHaveBeenCalledTimes(1);
      },
      { timeout: 15_000 }
    );

    lastWatcher()?.emit('error', new Error('EMFILE: too many open files'));

    await expect(watching).rejects.toThrow('EMFILE: too many open files');

    expect(started[0]?.aborted).toBe(true);
  });

  it('keeps watching after a build fails', async () => {
    const build = vi.fn().mockRejectedValueOnce(new Error('type error')).mockResolvedValue(undefined);

    const watching = watch(build);

    await vi.waitFor(
      () => {
        expect(build).toHaveBeenCalledTimes(1);
      },
      { timeout: 15_000 }
    );

    tmp.write('actions/todos.ts', 'export const a = 1;');

    await vi.waitFor(
      () => {
        expect(build).toHaveBeenCalledTimes(2);
      },
      { timeout: 15_000 }
    );

    controller.abort();
    await expect(watching).resolves.toBeUndefined();
  });

  it('reports a build failure that is not an Error', async () => {
    const build = vi.fn().mockRejectedValueOnce('something went wrong').mockResolvedValue(undefined);

    const watching = watch(build);

    await vi.waitFor(
      () => {
        expect(build).toHaveBeenCalledTimes(1);
      },
      { timeout: 15_000 }
    );

    expect(vi.mocked(ora()).fail.mock.calls.flat().map(String).join('\n')).toContain('something went wrong');

    controller.abort();
    await watching;
  });

  it('stops building once it is stopped', async () => {
    const build = vi.fn().mockResolvedValue(undefined);

    const watching = watch(build);

    await vi.waitFor(
      () => {
        expect(build).toHaveBeenCalledTimes(1);
      },
      { timeout: 15_000 }
    );

    controller.abort();
    await watching;

    tmp.write('actions/todos.ts', 'export const a = 1;');

    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 120));

    expect(build).toHaveBeenCalledTimes(1);
  });

  it('aborts the in-flight build when stopped, and waits for it to unwind', async () => {
    const { build, started, finishLatest } = createControllableBuild();

    const watching = watch(build);

    await vi.waitFor(
      () => {
        expect(build).toHaveBeenCalledTimes(1);
      },
      { timeout: 15_000 }
    );

    controller.abort();

    expect(started[0]?.aborted).toBe(true);

    finishLatest();

    await expect(watching).resolves.toBeUndefined();
  });
});
