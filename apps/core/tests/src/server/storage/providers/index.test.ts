import { describe, expect, it } from 'vitest';

import { createCloudflareBucket } from '#server/storage/providers/cloudflare.ts';
import { createFilesystemBucket } from '#server/storage/providers/filesystem.ts';
import { storageBucketFactories } from '#server/storage/providers/index.ts';
import { createVercelBucket } from '#server/storage/providers/vercel.ts';

describe('storageBucketFactories', () => {
  it('builds the buckets of each provider with that provider', () => {
    expect(storageBucketFactories).toEqual({ vercel: createVercelBucket, cloudflare: createCloudflareBucket, filesystem: createFilesystemBucket });
  });
});
