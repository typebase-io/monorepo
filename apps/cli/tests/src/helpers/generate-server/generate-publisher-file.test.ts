import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type PublisherProvider } from '#helpers/constants.ts';
import { generatePublisherFile } from '#helpers/generate-server/generate-publisher-file.ts';

import { removeExtraSpaces } from '#tests/helpers/remove-extra-spaces.ts';
import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('generatePublisherFile', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  const run = (source: string, { useTs = true, provider = 'db' }: { useTs?: boolean; provider?: PublisherProvider } = {}) => {
    tmp.write('publisher.ts', removeExtraSpaces(source));

    return generatePublisherFile({
      publisherFilePath: path.join(tmp.path, 'publisher.ts'),
      publisherOutputDirPath: path.join(tmp.path, 'out'),
      provider,
      useTs,
    });
  };

  const declaration = `
    import { definePublisher } from "typebase-io/server";
    import { z } from "zod";

    export const publisher = definePublisher({
      provider: "db",
      options: { pollIntervalMs: 500 },
      events: {
        "post.created": z.object({ id: z.number() }),
      },
    });
  `;

  it('builds the instance the server runs from what the project declared', async () => {
    await run(declaration);

    expect(tmp.read('out/publisher.ts')).toEqualTemplate('generate-publisher-file', 'db.ts.txt');
  });

  it('creates the output directory even when it does not exist yet', async () => {
    tmp.write('publisher.ts', removeExtraSpaces(declaration));

    await generatePublisherFile({
      publisherFilePath: path.join(tmp.path, 'publisher.ts'),
      publisherOutputDirPath: path.join(tmp.path, 'does', 'not', 'exist'),
      provider: 'db',
      useTs: true,
    });

    expect(tmp.exists('does/not/exist/publisher.ts')).toBe(true);
  });

  it('keeps the imports the events were described with', async () => {
    await run(`
      import { definePublisher } from "typebase-io/server";
      import * as v from "valibot";

      export const publisher = definePublisher({
        provider: "db",
        events: { "post.created": v.object({ id: v.number() }) },
      });
    `);

    expect(tmp.read('out/publisher.ts')).toEqualTemplate('generate-publisher-file', 'valibot.ts.txt');
  });

  it('points the imports it carries at the extension the server was generated with', async () => {
    tmp.write('schemas.ts', 'export const postCreated = {};');

    await run(
      `
        import { definePublisher } from "typebase-io/server";

        import { postCreated } from "./schemas";

        export const publisher = definePublisher({
          provider: "db",
          events: { "post.created": postCreated },
        });
      `,
      { useTs: false }
    );

    expect(tmp.read('out/publisher.ts')).toEqualTemplate('generate-publisher-file', 'db.js.txt');
  });

  it('throws when the file never calls definePublisher', async () => {
    await expect(run('export const publisher = { type: "database" };')).rejects.toThrow('no `definePublisher` call was found');
  });

  it('throws when definePublisher is not given an object literal', async () => {
    await expect(
      run(`
        import { definePublisher } from "typebase-io/server";

        export const publisher = definePublisher(config);
      `)
    ).rejects.toThrow('must be called with an inline object literal');
  });

  it('throws when there are no events to publish', async () => {
    await expect(
      run(`
        import { definePublisher } from "typebase-io/server";

        export const publisher = definePublisher({ type: "database" });
      `)
    ).rejects.toThrow('needs an `events` object');
  });
});
