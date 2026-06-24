import { describe, expect, it } from 'vitest';

import { isTsFile } from '#helpers/shared/is-ts-file.ts';

describe('isTsFile', () => {
  it('returns true for TypeScript source files', () => {
    expect(isTsFile('foo.ts')).toBe(true);
    expect(isTsFile('foo.tsx')).toBe(true);
    expect(isTsFile('foo.mts')).toBe(true);
    expect(isTsFile('foo.cts')).toBe(true);
    expect(isTsFile('nested/dir/foo.ts')).toBe(true);
  });

  it('returns false for declaration files', () => {
    expect(isTsFile('foo.d.ts')).toBe(false);
    expect(isTsFile('nested/foo.d.ts')).toBe(false);
  });

  it('returns false for JavaScript and other files', () => {
    expect(isTsFile('foo.js')).toBe(false);
    expect(isTsFile('foo.jsx')).toBe(false);
    expect(isTsFile('foo.mjs')).toBe(false);
    expect(isTsFile('foo.json')).toBe(false);
    expect(isTsFile('foo')).toBe(false);
  });
});
