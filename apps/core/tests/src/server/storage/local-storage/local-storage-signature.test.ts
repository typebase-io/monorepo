import { describe, expect, it } from 'vitest';

import { localStorageSignature } from '#server/storage/local-storage/local-storage-signature.ts';

describe('localStorageSignature', () => {
  const sign = (overrides: Partial<Parameters<typeof localStorageSignature>[0]> = {}) =>
    localStorageSignature({
      secret: 'secret',
      method: 'GET',
      bucket: 'avatars',
      key: 'me.png',
      params: new URLSearchParams({ expires: '100' }),
      ...overrides,
    });

  it('is a hex HMAC-SHA256', () => {
    expect(sign()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is the same for the same request', () => {
    expect(sign()).toBe(sign());
  });

  it('ignores the order of the params and the signature itself', () => {
    const params = new URLSearchParams([
      ['signature', 'whatever'],
      ['max-size', '10'],
      ['expires', '100'],
    ]);

    expect(sign({ params })).toBe(
      sign({
        params: new URLSearchParams([
          ['expires', '100'],
          ['max-size', '10'],
        ]),
      })
    );
  });

  it('keeps repeated params in the order they were given', () => {
    const params = (...values: string[]) => new URLSearchParams(values.map((value): [string, string] => ['tag', value]));

    expect(sign({ params: params('a', 'b') })).toBe(sign({ params: params('a', 'b') }));
    expect(sign({ params: params('a', 'b') })).not.toBe(sign({ params: params('b', 'a') }));
  });

  it.each([
    { name: 'secret', change: { secret: 'other' } },
    { name: 'method', change: { method: 'PUT' as const } },
    { name: 'bucket', change: { bucket: 'documents' } },
    { name: 'key', change: { key: 'you.png' } },
    { name: 'params', change: { params: new URLSearchParams({ expires: '101' }) } },
  ])('changes with the $name', ({ change }) => {
    expect(sign(change)).not.toBe(sign());
  });
});
