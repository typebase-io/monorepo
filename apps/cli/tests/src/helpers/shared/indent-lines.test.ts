import { describe, expect, it } from 'vitest';

import { indentLines } from '#helpers/shared/indent-lines.ts';

describe('indentLines', () => {
  it('indents every line one level', () => {
    expect(indentLines('a\n  b')).toBe('  a\n    b');
  });

  it('leaves blank lines empty, so the output has no trailing whitespace', () => {
    expect(indentLines('a\n\nb')).toBe('  a\n\n  b');
  });
});
