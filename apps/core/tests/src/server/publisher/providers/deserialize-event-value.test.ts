import { describe, expect, it } from 'vitest';

import { deserializeEventValue } from '#server/publisher/providers/deserialize-event-value.ts';
import { serializeEventValue } from '#server/publisher/providers/serialize-event-value.ts';

const throughJsonb = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

describe('deserializeEventValue', () => {
  it('restores dates, bigints, sets, maps and URLs from a stored row', () => {
    const payload = {
      id: 1,
      editedAt: new Date('2026-09-30T10:00:00.000Z'),
      views: 10n,
      tags: new Set(['news']),
      links: new Map([['home', new URL('https://typebase.io')]]),
      nested: { at: new Date('2026-09-29T08:30:00.000Z') },
    };

    const restored = deserializeEventValue(throughJsonb(serializeEventValue('post.edited', payload)));

    expect(restored).toEqual(payload);
    expect((restored as typeof payload).editedAt).toBeInstanceOf(Date);
  });

  it('restores a plain payload as it was published', () => {
    expect(deserializeEventValue(throughJsonb(serializeEventValue('post.created', { id: 1, value: 'hello' })))).toEqual({
      id: 1,
      value: 'hello',
    });
  });

  it('hands back a row written before payloads were serialized as it is', () => {
    expect(deserializeEventValue({ id: 1, createdAt: '2026-09-30T10:00:00.000Z' })).toEqual({ id: 1, createdAt: '2026-09-30T10:00:00.000Z' });
  });

  it.each([null, 'hello', 1, true, [1, 2]])('hands back %j as it is', (value) => {
    expect(deserializeEventValue(value)).toEqual(value);
  });

  it('refuses a row written in a format it does not know', () => {
    expect(() => deserializeEventValue({ '~typebase': 2, json: { id: 1 }, meta: [] })).toThrow(
      'An event in the events table was written in format 2, which this version of typebase-io cannot read. Upgrade typebase-io.'
    );
  });
});
