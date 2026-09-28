import { describe, expect, it } from 'vitest';

import { mediaType } from '#server/storage/local-storage/media-type.ts';

describe('mediaType', () => {
  it('drops the parameters, spaces and case of a content type', () => {
    expect(mediaType(' Text/HTML ; charset=utf-8')).toBe('text/html');
  });

  it('keeps a bare media type as it is', () => {
    expect(mediaType('image/png')).toBe('image/png');
  });

  it('is empty when there is no content type', () => {
    expect(mediaType(null)).toBe('');
  });
});
