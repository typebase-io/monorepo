import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateExampleActions } from '#helpers/init/generate-example-actions.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

const isDir = (tmp: TempDir, relativePath: string) => {
  const full = path.join(tmp.path, relativePath);

  return fs.existsSync(full) && fs.statSync(full).isDirectory();
};

describe('generateExampleActions', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('creates the queries and mutations directories', async () => {
    await generateExampleActions({ typebaseDirPath: tmp.path, withAuth: true });

    expect(isDir(tmp, 'actions/queries')).toBe(true);
    expect(isDir(tmp, 'actions/mutations')).toBe(true);
  });

  it('creates the directories even when the typebase directory does not exist yet', async () => {
    const nestedTypebaseDir = path.join(tmp.path, 'does', 'not', 'exist', 'yet');

    await generateExampleActions({ typebaseDirPath: nestedTypebaseDir, withAuth: false });

    expect(fs.statSync(path.join(nestedTypebaseDir, 'actions', 'queries')).isDirectory()).toBe(true);
    expect(fs.statSync(path.join(nestedTypebaseDir, 'actions', 'mutations')).isDirectory()).toBe(true);
  });

  it('writes query and mutation todos plus custom actions when withAuth is true', async () => {
    await generateExampleActions({ typebaseDirPath: tmp.path, withAuth: true });

    expect(tmp.read('actions/queries/todos.ts')).toEqualTemplate('generate-example-actions', 'queries-with-auth.txt');
    expect(tmp.read('actions/mutations/todos.ts')).toEqualTemplate('generate-example-actions', 'mutations-with-auth.txt');
    expect(tmp.read('actions/custom-actions.ts')).toEqualTemplate('generate-example-actions', 'custom-actions.txt');
  });

  it('does not write custom actions when withAuth is false', async () => {
    await generateExampleActions({ typebaseDirPath: tmp.path, withAuth: false });

    expect(tmp.read('actions/queries/todos.ts')).toEqualTemplate('generate-example-actions', 'queries-without-auth.txt');
    expect(tmp.read('actions/mutations/todos.ts')).toEqualTemplate('generate-example-actions', 'mutations-without-auth.txt');
    expect(tmp.exists('actions/custom-actions.ts')).toBe(false);
  });
});
