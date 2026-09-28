import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensureLocalStorageRoot } from '#server/storage/local-storage/ensure-local-storage-root.ts';

describe('ensureLocalStorageRoot', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'typebase-local-root-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates the root, however deep, and keeps it out of git', () => {
    const root = path.join(dir, 'a', 'b', '.local-storage');

    ensureLocalStorageRoot(root);

    expect(existsSync(root)).toBe(true);
    expect(readFileSync(path.join(root, '.gitignore'), 'utf8')).toBe('*\n');
  });

  it('leaves a .gitignore that is already there alone', () => {
    writeFileSync(path.join(dir, '.gitignore'), '*\n!keep.txt\n');

    ensureLocalStorageRoot(dir);

    expect(readFileSync(path.join(dir, '.gitignore'), 'utf8')).toBe('*\n!keep.txt\n');
  });

  it('fails when the .gitignore cannot be written for any other reason', () => {
    chmodSync(dir, 0o500);

    try {
      expect(() => {
        ensureLocalStorageRoot(dir);
      }).toThrow(expect.objectContaining({ code: 'EACCES' }) as Error);
    } finally {
      chmodSync(dir, 0o700);
    }
  });
});
