import path from 'node:path';

import { type SourceFile } from 'ts-morph';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { editTsFiles } from '#helpers/shared/edit-ts-files.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('editTsFiles', () => {
  let tmp: TempDir;

  const rename = (name: string) => (sourceFile: SourceFile) => {
    sourceFile.getVariableDeclarationOrThrow('x').rename(name);

    return true;
  };

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('saves the files the edit reports it changed', async () => {
    tmp.write('index.ts', 'export const x = 1;');

    await editTsFiles(tmp.path, rename('renamed'));

    expect(tmp.read('index.ts')).toBe('export const renamed = 1;');
  });

  it('leaves the file on disk untouched when the edit reports no change, even if it manipulated the source', async () => {
    tmp.write('index.ts', 'export const x = 1;');

    await editTsFiles(tmp.path, (sourceFile) => {
      sourceFile.getVariableDeclarationOrThrow('x').rename('renamed');

      return false;
    });

    expect(tmp.read('index.ts')).toBe('export const x = 1;');
  });

  it('edits files in nested folders', async () => {
    tmp.write('nested/deep/index.ts', 'export const x = 1;');

    await editTsFiles(tmp.path, rename('renamed'));

    expect(tmp.read('nested/deep/index.ts')).toBe('export const renamed = 1;');
  });

  it('visits every typescript file in the directory', async () => {
    tmp.write('one.ts', 'export const x = 1;');
    tmp.write('nested/two.ts', 'export const x = 2;');

    const visited: string[] = [];

    await editTsFiles(tmp.path, (sourceFile) => {
      visited.push(path.basename(sourceFile.getFilePath()));

      return false;
    });

    expect(visited.sort()).toEqual(['one.ts', 'two.ts']);
  });

  it('visits neither javascript files nor declaration files', async () => {
    tmp.write('kept.js', 'export const x = 1;');
    tmp.write('kept.d.ts', 'export declare const x: number;');

    const visited: string[] = [];

    await editTsFiles(tmp.path, (sourceFile) => {
      visited.push(sourceFile.getFilePath());

      return true;
    });

    expect(visited).toEqual([]);
    expect(tmp.read('kept.js')).toBe('export const x = 1;');
    expect(tmp.read('kept.d.ts')).toBe('export declare const x: number;');
  });

  it('does nothing for a directory that does not exist', async () => {
    await expect(editTsFiles(path.join(tmp.path, 'missing'), rename('renamed'))).resolves.toBeUndefined();
  });
});
