import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateExampleSchema } from '#helpers/init/generate-example-schema.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('generateExampleSchema', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('writes the schema template with auth fields when withAuth is true', async () => {
    await generateExampleSchema({ path: path.join(tmp.path, 'schema.ts'), withAuth: true, withPublisher: false });

    expect(tmp.read('schema.ts')).toEqualTemplate('generate-example-schema', 'with-auth.txt');
  });

  it('writes the schema template without auth fields when withAuth is false', async () => {
    await generateExampleSchema({ path: path.join(tmp.path, 'schema.ts'), withAuth: false, withPublisher: false });

    expect(tmp.read('schema.ts')).toEqualTemplate('generate-example-schema', 'without-auth.txt');
  });

  it('writes the schema template with the events table when withPublisher is true', async () => {
    await generateExampleSchema({ path: path.join(tmp.path, 'schema.ts'), withAuth: false, withPublisher: true });

    expect(tmp.read('schema.ts')).toEqualTemplate('generate-example-schema', 'with-publisher.txt');
  });
});
