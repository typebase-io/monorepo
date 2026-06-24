import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { stripExtension } from '#helpers/shared/strip-extension.ts';

describe('stripExtension', () => {
  it('strips common TS/JS extensions', () => {
    expect(stripExtension('foo.ts')).toBe('foo');
    expect(stripExtension('foo.tsx')).toBe('foo');
    expect(stripExtension('foo.js')).toBe('foo');
    expect(stripExtension('foo.jsx')).toBe('foo');
    expect(stripExtension('foo.mts')).toBe('foo');
    expect(stripExtension('foo.cts')).toBe('foo');
    expect(stripExtension('foo.mjs')).toBe('foo');
    expect(stripExtension('foo.cjs')).toBe('foo');
  });

  it('strips declaration file extensions', () => {
    expect(stripExtension('foo.d.ts')).toBe('foo');
  });

  it('only strips the final extension', () => {
    expect(stripExtension('foo.test.ts')).toBe('foo.test');
    expect(stripExtension('foo.config.js')).toBe('foo.config');
  });

  it('leaves non-script extensions untouched', () => {
    expect(stripExtension('foo.json')).toBe('foo.json');
    expect(stripExtension('foo.css')).toBe('foo.css');
    expect(stripExtension('foo')).toBe('foo');
  });

  it('normalizes the path before stripping', () => {
    expect(stripExtension(path.join('src', 'foo.ts'))).toBe(path.join('src', 'foo'));
    expect(stripExtension('src/../foo.ts')).toBe('foo');
  });
});
