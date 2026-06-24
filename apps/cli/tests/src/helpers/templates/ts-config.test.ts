import { describe, expect, it } from 'vitest';

import { tsConfigTemplate } from '#helpers/templates/ts-config.ts';

describe('tsConfigTemplate', () => {
  it('renders the tsconfig with the auto-generated warning header when requested', () => {
    expect(tsConfigTemplate(true)).toEqualTemplate('ts-config', 'warning.txt');
  });

  it('renders the tsconfig without the warning header by default', () => {
    expect(tsConfigTemplate(false)).toEqualTemplate('ts-config', 'no-warning.txt');
  });
});
