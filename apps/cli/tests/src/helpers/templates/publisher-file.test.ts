import { describe, expect, it } from 'vitest';

import { publisherFileTemplate } from '#helpers/templates/publisher-file.ts';

import { removeExtraSpaces } from '#tests/helpers/remove-extra-spaces.ts';

describe('publisherFileTemplate', () => {
  const CONFIG = removeExtraSpaces(`
    {
      provider: "db",
      options: { pollIntervalMs: 500 },
      events: {
        "post.created": z.object({ id: z.number() }),
      },
    }
  `).trimEnd();

  describe('with typescript', () => {
    it('hands the database to the db provider, which keeps events in it', () => {
      expect(publisherFileTemplate({ config: '{ provider: "db", events: {} }', imports: [], provider: 'db', ts: true })).toEqualTemplate(
        'publisher-file',
        'with-typescript',
        'db.txt'
      );
    });

    it('keeps the imports the events were described with, above the config that uses them', () => {
      expect(publisherFileTemplate({ config: CONFIG, imports: ['import { z } from "zod";'], provider: 'db', ts: true })).toEqualTemplate(
        'publisher-file',
        'with-typescript',
        'with-imports.txt'
      );
    });
  });

  describe('without typescript', () => {
    it('points the resources it imports at the extension the server was generated with', () => {
      expect(publisherFileTemplate({ config: '{ provider: "db", events: {} }', imports: [], provider: 'db', ts: false })).toEqualTemplate(
        'publisher-file',
        'without-typescript',
        'db.txt'
      );
    });

    it('keeps the imports the events were described with, above the config that uses them', () => {
      expect(publisherFileTemplate({ config: CONFIG, imports: ['import { z } from "zod";'], provider: 'db', ts: false })).toEqualTemplate(
        'publisher-file',
        'without-typescript',
        'with-imports.txt'
      );
    });
  });
});
