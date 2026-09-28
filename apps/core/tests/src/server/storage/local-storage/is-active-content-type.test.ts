import { describe, expect, it } from 'vitest';

import { isActiveContentType } from '#server/storage/local-storage/is-active-content-type.ts';

describe('isActiveContentType', () => {
  it.each(['text/html', 'text/html; charset=utf-8', 'TEXT/HTML', 'text/xml', 'application/xml', 'image/svg+xml', 'application/xhtml+xml'])(
    'treats %j as content a browser would run',
    (contentType) => {
      expect(isActiveContentType(contentType)).toBe(true);
    }
  );

  it.each(['text/plain', 'image/png', 'application/json', 'application/pdf', 'application/octet-stream', ''])(
    'treats %j as passive',
    (contentType) => {
      expect(isActiveContentType(contentType)).toBe(false);
    }
  );
});
