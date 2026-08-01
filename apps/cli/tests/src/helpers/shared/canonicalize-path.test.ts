import type * as NodeFs from 'node:fs';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { canonicalizePath } from '#helpers/shared/canonicalize-path.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

const { fsFailures } = vi.hoisted(() => ({ fsFailures: { realpath: undefined as Error | undefined } }));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeFs>();

  return {
    ...actual,
    default: actual,
    realpathSync: (...args: Parameters<typeof actual.realpathSync>) => {
      if (fsFailures.realpath) {
        throw fsFailures.realpath;
      }

      return actual.realpathSync(...args);
    },
  };
});

describe('canonicalizePath', () => {
  let tmp: TempDir;

  beforeEach(() => {
    fsFailures.realpath = undefined;
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('resolves a symlink to its target', () => {
    const target = tmp.mkdir('real');

    symlinkSync(target, path.join(tmp.path, 'link'), 'dir');

    expect(canonicalizePath(path.join(tmp.path, 'link'))).toBe(target);
  });

  it('resolves a symlink in the middle of a path', () => {
    const target = tmp.mkdir('real');

    mkdirSync(path.join(target, 'nested'));
    symlinkSync(target, path.join(tmp.path, 'link'), 'dir');

    expect(canonicalizePath(path.join(tmp.path, 'link', 'nested'))).toBe(path.join(target, 'nested'));
  });

  it('leaves a path with no symlinks alone', () => {
    const dirPath = tmp.mkdir('plain');

    expect(canonicalizePath(dirPath)).toBe(dirPath);
  });

  it('resolves the existing part of a path that does not exist yet', () => {
    const target = tmp.mkdir('real');

    symlinkSync(target, path.join(tmp.path, 'link'), 'dir');

    expect(canonicalizePath(path.join(tmp.path, 'link', '_server'))).toBe(path.join(target, '_server'));
  });

  it('resolves a file, not just a directory', () => {
    const filePath = path.join(tmp.path, 'file.ts');

    writeFileSync(filePath, 'export const a = 1;');

    expect(canonicalizePath(filePath)).toBe(filePath);
  });

  it('stops at the root when nothing along the path can be resolved', () => {
    fsFailures.realpath = new Error('EACCES: permission denied');

    expect(canonicalizePath(path.join(tmp.path, 'a', 'b'))).toBe(path.join(tmp.path, 'a', 'b'));
  });
});
