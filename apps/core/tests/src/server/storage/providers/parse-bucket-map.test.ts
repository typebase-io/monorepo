import { describe, expect, it } from 'vitest';

import { parseBucketMap } from '#server/storage/providers/parse-bucket-map.ts';

describe('parseBucketMap', () => {
  it('reads a JSON object from bucket name to string', () => {
    expect(parseBucketMap('{"avatars":"a","documents":"d"}')).toEqual({ avatars: 'a', documents: 'd' });
  });

  it('reads an empty object', () => {
    expect(parseBucketMap('{}')).toEqual({});
  });

  it.each(['not json', '', 'null', '[]', '["a"]', '"a"', '1', '{"avatars":1}', '{"avatars":null}', '{"avatars":{"nested":"a"}}'])(
    'is undefined for %j',
    (value) => {
      expect(parseBucketMap(value)).toBeUndefined();
    }
  );
});
