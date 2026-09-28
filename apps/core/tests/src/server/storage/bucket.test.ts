import { describe, expect, it } from 'vitest';

import { BUCKET_OPERATIONS } from '#server/storage/bucket.ts';

describe('BUCKET_OPERATIONS', () => {
  it('lists every files-sdk operation a bucket exposes, and none that reach outside it', () => {
    expect(BUCKET_OPERATIONS).toEqual(['upload', 'download', 'head', 'exists', 'delete', 'copy', 'move', 'list', 'listAll', 'search']);
  });
});
