import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateExamplePublisher } from '#helpers/init/generate-example-publisher.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('generateExamplePublisher', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('writes a publisher file declaring the db provider and an example event', async () => {
    await generateExamplePublisher(path.join(tmp.path, 'publisher.ts'));

    expect(tmp.read('publisher.ts')).toEqualTemplate('generate-example-publisher', 'default.txt');
  });
});
