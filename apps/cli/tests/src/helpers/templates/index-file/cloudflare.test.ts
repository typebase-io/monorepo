import { describe, expect, it } from 'vitest';

import { cloudflareIndexFileTemplate } from '#helpers/templates/index-file/cloudflare.ts';

describe('cloudflareIndexFileTemplate', () => {
  it('exports the construction unit as the worker fetch handler', () => {
    expect(cloudflareIndexFileTemplate).toEqualTemplate('index-file', 'cloudflare', 'default.txt');
  });
});
