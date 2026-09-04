import { describe, expect, it } from 'vitest';

import { honoIndexFileTemplate } from '#helpers/templates/index-file/hono.ts';

describe('honoIndexFileTemplate', () => {
  it('exports the construction unit as the served application', () => {
    expect(honoIndexFileTemplate).toEqualTemplate('index-file', 'hono', 'default.txt');
  });
});
