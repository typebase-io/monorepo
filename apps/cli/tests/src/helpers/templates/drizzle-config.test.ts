import { describe, expect, it } from 'vitest';

import { drizzleConfigTemplate } from '#helpers/templates/drizzle-config.ts';

describe('drizzleConfigTemplate', () => {
  it('reads the credentials from the generated .ts env module with typescript', () => {
    expect(drizzleConfigTemplate({ ts: true })).toEqualTemplate('drizzle-config', 'with-typescript.txt');
  });

  it('reads the credentials from the generated .js env module without typescript', () => {
    expect(drizzleConfigTemplate({ ts: false })).toEqualTemplate('drizzle-config', 'without-typescript.txt');
  });
});
