import { renameSync } from 'node:fs';
import path from 'node:path';

import type * as Chokidar from 'chokidar';
import { type FSWatcher } from 'chokidar';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { watchDirectory } from '#helpers/shared/watch-directory.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

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

describe('watchDirectory', { retry: 2 }, () => {
  let tmp: TempDir;
  let stop: (() => Promise<void>) | undefined;

  const lastWatcher = () => watchers.at(-1);

  const watching = async (options: Parameters<typeof watchDirectory>[0]) => {
    await new Promise((resolve) => setTimeout(resolve, 80));

    const { ready, stop: stopWatching } = watchDirectory(options);

    await ready;

    return stopWatching;
  };

  beforeEach(() => {
    watchers.length = 0;
    tmp = createTempDir();
    tmp.mkdir('actions');
  });

  afterEach(async () => {
    await stop?.();
    stop = undefined;
    tmp.cleanup();
  });

  it('reports a change to a watched file', async () => {
    const onChange = vi.fn();

    stop = await watching({ dirPath: tmp.path, onChange });

    tmp.write('actions/todos.ts', 'export const a = 1;');

    await vi.waitFor(
      () => {
        expect(onChange).toHaveBeenCalled();
      },
      { timeout: 15_000 }
    );
  });

  it('reports changes as they arrive, leaving coalescing to the caller', async () => {
    const onChange = vi.fn();

    stop = await watching({ dirPath: tmp.path, onChange });

    tmp.write('actions/one.ts', 'export const a = 1;');
    tmp.write('actions/two.ts', 'export const b = 2;');

    await vi.waitFor(
      () => {
        expect(onChange.mock.calls.length).toBeGreaterThanOrEqual(2);
      },
      { timeout: 15_000 }
    );
  });

  it('reports a new file, not just edits to existing ones', async () => {
    const onChange = vi.fn();

    stop = await watching({ dirPath: tmp.path, onChange });

    tmp.write('actions/queries/todos.ts', 'export const a = 1;');

    await vi.waitFor(
      () => {
        expect(onChange).toHaveBeenCalled();
      },
      { timeout: 15_000 }
    );
  });

  it('reports a renamed file, which changes the generated router', async () => {
    const onChange = vi.fn();

    const filePath = tmp.write('actions/todos.ts', 'export const a = 1;');

    stop = await watching({ dirPath: tmp.path, onChange });

    renameSync(filePath, path.join(tmp.path, 'actions', 'renamed.ts'));

    await vi.waitFor(
      () => {
        expect(onChange).toHaveBeenCalled();
      },
      { timeout: 15_000 }
    );
  });

  it('says nothing about the files that already existed when it started', async () => {
    const onChange = vi.fn();

    tmp.write('actions/todos.ts', 'export const a = 1;');
    tmp.write('db/schema.ts', 'export const schema = {};');

    stop = await watching({ dirPath: tmp.path, onChange });

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores changes inside an ignored directory', async () => {
    const onChange = vi.fn();

    tmp.mkdir('_server');

    stop = await watching({ dirPath: tmp.path, ignoredDirPaths: [path.join(tmp.path, '_server')], onChange });

    tmp.write('_server/package.json', '{}');
    tmp.write('_server/src/index.ts', 'export const a = 1;');

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('still reports changes outside the ignored directories', async () => {
    const onChange = vi.fn();

    tmp.mkdir('_generated');

    stop = await watching({ dirPath: tmp.path, ignoredDirPaths: [path.join(tmp.path, '_generated')], onChange });

    tmp.write('_generated/server.ts', 'export const generated = 1;');
    tmp.write('actions/todos.ts', 'export const a = 1;');

    await vi.waitFor(
      () => {
        expect(onChange).toHaveBeenCalled();
      },
      { timeout: 15_000 }
    );
  });

  it.each([
    { name: 'the watched directory itself', ignored: () => tmp.path },
    { name: 'a parent of the watched directory', ignored: () => path.dirname(tmp.path) },
  ])('keeps watching when $name is passed as ignored, which would otherwise match everything', async ({ ignored }) => {
    const onChange = vi.fn();

    stop = await watching({ dirPath: tmp.path, ignoredDirPaths: [ignored()], onChange });

    tmp.write('actions/todos.ts', 'export const a = 1;');

    await vi.waitFor(
      () => {
        expect(onChange).toHaveBeenCalled();
      },
      { timeout: 15_000 }
    );
  });

  it('reports a watcher failure instead of crashing the process', async () => {
    const onError = vi.fn();

    stop = await watching({ dirPath: tmp.path, onChange: vi.fn(), onError });

    lastWatcher()?.emit('error', new Error('EMFILE: too many open files'));

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'EMFILE: too many open files' }));
  });

  it('reports a failure that is not an Error as one', async () => {
    const onError = vi.fn();

    stop = await watching({ dirPath: tmp.path, onChange: vi.fn(), onError });

    lastWatcher()?.emit('error', 'EMFILE' as unknown as Error);

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'EMFILE' }));
  });

  it('reports nothing after it is stopped', async () => {
    const onChange = vi.fn();

    const stopWatching = await watching({ dirPath: tmp.path, onChange });

    await stopWatching();

    tmp.write('actions/todos.ts', 'export const a = 1;');

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(onChange).not.toHaveBeenCalled();
  });
});
