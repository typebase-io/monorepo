import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getPublisherProvider } from '#helpers/shared/get-publisher-provider.ts';

import { removeExtraSpaces } from '#tests/helpers/remove-extra-spaces.ts';
import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('getPublisherProvider', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  const read = (source: string) => {
    tmp.write('publisher.ts', removeExtraSpaces(source));

    return getPublisherProvider(path.join(tmp.path, 'publisher.ts'));
  };

  it('reads the provider a publisher was declared with', () => {
    expect(
      read(`
        import { definePublisher } from "typebase-io/server";

        export const publisher = definePublisher({
          provider: "db",
          events: {},
        });
      `)
    ).toBe('db');
  });

  it('refuses a provider Typebase does not have', () => {
    expect(() => read('export const publisher = definePublisher({ provider: "redis", events: {} });')).toThrow(
      '`publisher.ts` asks for the `redis` publisher, which Typebase does not have. Pick one of: db.'
    );
  });

  it('reads it from a config held in a variable', () => {
    expect(
      read(`
        const config = { provider: "db", events: {} };

        export const publisher = definePublisher(config);
      `)
    ).toBe('db');
  });

  it('refuses a provider that is not a plain string, since it cannot be read without running the file', () => {
    expect(() => read('export const publisher = definePublisher({ provider: chosenProvider, events: {} });')).toThrow(
      'Could not read which publisher `publisher.ts` asks for. `definePublisher` needs a `provider` written as a plain string, one of: db.'
    );
  });

  it('refuses a publisher file that never calls definePublisher', () => {
    expect(() => read('export const publisher = { provider: "db" };')).toThrow(
      '`publisher.ts` does not call `definePublisher`. Export a publisher from it, or delete the file.'
    );
  });

  it('is undefined when there is no publisher file', () => {
    expect(getPublisherProvider(path.join(tmp.path, 'missing.ts'))).toBeUndefined();
  });
});
