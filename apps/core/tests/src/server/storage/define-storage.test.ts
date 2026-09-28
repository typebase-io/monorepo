import { describe, expect, it } from 'vitest';

import { defineStorage } from '#server/storage/define-storage.ts';

describe('defineStorage', () => {
  it('describes the storage without building it', () => {
    const config = defineStorage({ provider: 'filesystem', options: { root: '/tmp/files' }, buckets: { avatars: {}, documents: {} } });

    expect(config.provider).toBe('filesystem');
    expect(config.options).toEqual({ root: '/tmp/files' });
    expect(Object.keys(config.buckets)).toEqual(['avatars', 'documents']);
  });

  it('hands back the very config it was given', () => {
    const config = { provider: 'vercel' as const, buckets: { avatars: { access: 'public' as const } } };

    expect(defineStorage(config)).toBe(config);
  });
});
