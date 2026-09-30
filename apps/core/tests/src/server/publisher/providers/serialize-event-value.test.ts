import { describe, expect, it } from 'vitest';

import { ServerError } from '#server/error/index.ts';
import { serializeEventValue } from '#server/publisher/providers/serialize-event-value.ts';

describe('serializeEventValue', () => {
  it('stores a plain payload as it is, marked with the format it was written in', () => {
    expect(serializeEventValue('post.created', { id: 1, value: 'hello' })).toEqual({
      '~typebase': 1,
      json: { id: 1, value: 'hello' },
      meta: [],
    });
  });

  it('writes a date as a string and records that it was one', () => {
    expect(serializeEventValue('post.edited', { id: 1, editedAt: new Date('2026-09-30T10:00:00.000Z') })).toEqual({
      '~typebase': 1,
      json: { id: 1, editedAt: '2026-09-30T10:00:00.000Z' },
      meta: [[1, 'editedAt']],
    });
  });

  it('writes a value a jsonb column holds unchanged', () => {
    const serialized = serializeEventValue('post.edited', {
      editedAt: new Date('2026-09-30T10:00:00.000Z'),
      views: 10n,
      tags: new Set(['news']),
      links: new Map([['home', new URL('https://typebase.io')]]),
    });

    expect(JSON.parse(JSON.stringify(serialized))).toEqual(serialized);
  });

  it('leaves out fields that are undefined', () => {
    expect(serializeEventValue('post.edited', { id: 1, note: undefined })).toEqual({ '~typebase': 1, json: { id: 1 }, meta: [] });
  });

  it.each([
    { name: 'Blob', value: new Blob(['hello']) },
    { name: 'File', value: new File(['hello'], 'hello.txt') },
  ])('refuses a payload holding a $name, naming the event', ({ value }) => {
    const publish = () => serializeEventValue('post.attached', { id: 1, file: value });

    expect(publish).toThrow(ServerError);
    expect(publish).toThrow(
      'The payload published as `post.attached` holds a Blob or File, which the events table cannot store. Upload it to storage and publish its key instead.'
    );
  });
});
