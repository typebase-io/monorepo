import { describe, expect, it } from 'vitest';

import * as internal from '#internal/index.ts';

describe('internal entry point', () => {
  it('exports the api the generated server uses', () => {
    expect(Object.keys(internal).sort()).toEqual(['Action', 'createPublisher', 'createStorage', 'filterActions']);
  });
});
