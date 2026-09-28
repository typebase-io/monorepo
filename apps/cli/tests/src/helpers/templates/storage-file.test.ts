import { describe, expect, it } from 'vitest';

import { storageFileTemplate } from '#helpers/templates/storage-file.ts';

import { removeExtraSpaces } from '#tests/helpers/remove-extra-spaces.ts';

describe('storageFileTemplate', () => {
  it('builds the filesystem storage, which needs nothing from the environment', () => {
    expect(
      storageFileTemplate({ config: '{ provider: "filesystem", buckets: { avatars: {} } }', imports: [], provider: 'filesystem', ts: true })
    ).toEqualTemplate('storage-file', 'filesystem.txt');
  });

  it('keeps a filesystem storage on its own root, even when local storage is given', () => {
    expect(
      storageFileTemplate({
        config: '{ provider: "filesystem", buckets: { avatars: {} } }',
        imports: [],
        provider: 'filesystem',
        localStorage: { root: '/cache/storage', url: 'http://127.0.0.1:8080/storage' },
        ts: true,
      })
    ).toEqualTemplate('storage-file', 'filesystem.txt');
  });

  it.each(['vercel', 'cloudflare'] as const)('runs a %s storage on local storage, rooted at the directory it was given', (provider) => {
    expect(
      storageFileTemplate({
        config: `{ provider: "${provider}", buckets: { avatars: { access: "public" } } }`,
        imports: [],
        provider,
        localStorage: { root: '/cache/storage', url: 'http://127.0.0.1:8080/storage' },
        ts: true,
      })
    ).toEqualTemplate('storage-file', `local-${provider}.txt`);
  });

  it.each([
    { ts: true, fixture: 'vercel.ts.txt' },
    { ts: false, fixture: 'vercel.js.txt' },
  ])('builds a vercel storage from the Blob store tokens in the environment ($fixture)', ({ ts, fixture }) => {
    expect(
      storageFileTemplate({ config: '{ provider: "vercel", buckets: { avatars: { access: "public" } } }', imports: [], provider: 'vercel', ts })
    ).toEqualTemplate('storage-file', fixture);
  });

  it.each([
    { ts: true, fixture: 'cloudflare.ts.txt' },
    { ts: false, fixture: 'cloudflare.js.txt' },
  ])('builds a cloudflare storage from the R2 keys and public base URLs in the environment ($fixture)', ({ ts, fixture }) => {
    expect(
      storageFileTemplate({
        config:
          '{ provider: "cloudflare", buckets: { avatars: { access: "public" }, "user-banners": { access: "public" }, documents: { access: "private" } } }',
        imports: [],
        provider: 'cloudflare',
        publicBuckets: ['avatars', 'user-banners'],
        ts,
      })
    ).toEqualTemplate('storage-file', fixture);
  });

  it('keeps the imports the buckets were described with, above the config that uses them', () => {
    const config = removeExtraSpaces(`
      {
        provider: "filesystem",
        buckets: {
          documents: { plugins: [contentType()] },
        },
      }
    `).trimEnd();

    expect(
      storageFileTemplate({ config, imports: ['import { contentType } from "files-sdk/content-type";'], provider: 'filesystem', ts: true })
    ).toEqualTemplate('storage-file', 'with-imports.txt');
  });
});
