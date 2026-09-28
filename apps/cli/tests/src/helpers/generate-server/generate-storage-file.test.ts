import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateStorageFile } from '#helpers/generate-server/generate-storage-file.ts';

import { removeExtraSpaces } from '#tests/helpers/remove-extra-spaces.ts';
import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('generateStorageFile', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  const run = (source: string, { useTs = true }: { useTs?: boolean } = {}) => {
    tmp.write('storage.ts', removeExtraSpaces(source));

    return generateStorageFile({
      storageFilePath: path.join(tmp.path, 'storage.ts'),
      storageOutputDirPath: path.join(tmp.path, 'out'),
      provider: 'filesystem',
      useTs,
    });
  };

  const declaration = `
    import { defineStorage } from "typebase-io/server";

    export const storage = defineStorage({
      provider: "filesystem",
      options: { root: "/var/files" },
      buckets: {
        avatars: {},
        documents: { prefix: "docs" },
      },
    });
  `;

  it('builds the instance the server runs from what the project declared', async () => {
    await run(declaration);

    expect(tmp.read('out/storage.ts')).toEqualTemplate('generate-storage-file', 'filesystem.ts.txt');
  });

  it('creates the output directory even when it does not exist yet', async () => {
    tmp.write('storage.ts', removeExtraSpaces(declaration));

    await generateStorageFile({
      storageFilePath: path.join(tmp.path, 'storage.ts'),
      storageOutputDirPath: path.join(tmp.path, 'does', 'not', 'exist'),
      provider: 'filesystem',
      useTs: true,
    });

    expect(tmp.exists('does/not/exist/storage.ts')).toBe(true);
  });

  it('keeps the imports the buckets were described with, pointed at the extension the server was generated with', async () => {
    tmp.write('hooks.ts', 'export const logUploads = {};');

    await run(
      `
        import { defineStorage } from "typebase-io/server";
        import { contentType } from "files-sdk/content-type";

        import { logUploads } from "./hooks";

        export const storage = defineStorage({
          provider: "filesystem",
          buckets: { documents: { plugins: [contentType()], hooks: logUploads } },
        });
      `,
      { useTs: false }
    );

    expect(tmp.read('out/storage.ts')).toEqualTemplate('generate-storage-file', 'with-imports.js.txt');
  });

  describe('on a cloud storage provider', () => {
    const cloudDeclaration = `
      import { defineStorage } from "typebase-io/server";

      export const storage = defineStorage({
        provider: "vercel",
        buckets: {
          avatars: { access: "public" },
          documents: { access: "private", prefix: "docs" },
        },
      });
    `;

    it('runs the storage on local storage, rooted at the directory it was given', async () => {
      tmp.write('storage.ts', removeExtraSpaces(cloudDeclaration));

      await generateStorageFile({
        storageFilePath: path.join(tmp.path, 'storage.ts'),
        storageOutputDirPath: path.join(tmp.path, 'out'),
        provider: 'vercel',
        useTs: true,
        localStorage: { root: '/cache/storage', url: 'http://127.0.0.1:8080/storage' },
      });

      expect(tmp.read('out/storage.ts')).toEqualTemplate('generate-storage-file', 'local-vercel.ts.txt');
    });

    it('reads the Blob store tokens from the environment without local storage', async () => {
      tmp.write('storage.ts', removeExtraSpaces(cloudDeclaration));

      await generateStorageFile({
        storageFilePath: path.join(tmp.path, 'storage.ts'),
        storageOutputDirPath: path.join(tmp.path, 'out'),
        provider: 'vercel',
        useTs: true,
      });

      expect(tmp.read('out/storage.ts')).toEqualTemplate('generate-storage-file', 'vercel.ts.txt');
    });

    it('reads the R2 keys, and the public base URL of each public bucket, from the environment without local storage', async () => {
      tmp.write('storage.ts', removeExtraSpaces(cloudDeclaration.replace('"vercel"', '"cloudflare"')));

      await generateStorageFile({
        storageFilePath: path.join(tmp.path, 'storage.ts'),
        storageOutputDirPath: path.join(tmp.path, 'out'),
        provider: 'cloudflare',
        useTs: true,
      });

      expect(tmp.read('out/storage.ts')).toEqualTemplate('generate-storage-file', 'cloudflare.ts.txt');
    });
  });

  it('keeps a filesystem storage on its own root when local storage is given', async () => {
    tmp.write('storage.ts', removeExtraSpaces(declaration));

    await generateStorageFile({
      storageFilePath: path.join(tmp.path, 'storage.ts'),
      storageOutputDirPath: path.join(tmp.path, 'out'),
      provider: 'filesystem',
      useTs: true,
      localStorage: { root: '/cache/storage', url: 'http://127.0.0.1:8080/storage' },
    });

    expect(tmp.read('out/storage.ts')).toEqualTemplate('generate-storage-file', 'filesystem.ts.txt');
  });

  it('throws when the file never calls defineStorage', async () => {
    await expect(run('export const storage = { provider: "filesystem" };')).rejects.toThrow('no `defineStorage` call was found');
  });

  it('throws when defineStorage is not given an object literal', async () => {
    await expect(
      run(`
        import { defineStorage } from "typebase-io/server";

        export const storage = defineStorage(config);
      `)
    ).rejects.toThrow('must be called with an inline object literal');
  });

  it('throws when there are no buckets', async () => {
    await expect(
      run(`
        import { defineStorage } from "typebase-io/server";

        export const storage = defineStorage({ provider: "filesystem" });
      `)
    ).rejects.toThrow('needs a `buckets` object');
  });
});
