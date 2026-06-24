import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTrustedOriginsFromAuth } from '#helpers/shared/get-trusted-origins-from-auth.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('getTrustedOriginsFromAuth', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
    vi.restoreAllMocks();
  });

  it('extracts string literal trusted origins from defineAuth', () => {
    const authPath = tmp.write(
      'auth.ts',
      `export const auth = defineAuth({
        trustedOrigins: ['https://a.com', "https://b.com"],
      });`
    );

    expect(getTrustedOriginsFromAuth(authPath)).toEqual(['https://a.com', 'https://b.com']);
  });

  it('returns an empty array when trustedOrigins is absent', () => {
    const authPath = tmp.write('auth.ts', `export const auth = defineAuth({ basePath: '/api/auth' });`);

    expect(getTrustedOriginsFromAuth(authPath)).toEqual([]);
  });

  it('returns an empty array when there is no defineAuth call', () => {
    const authPath = tmp.write('auth.ts', `export const auth = something({ trustedOrigins: ['https://a.com'] });`);

    expect(getTrustedOriginsFromAuth(authPath)).toEqual([]);
  });

  it('skips non-literal entries and warns about them', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const authPath = tmp.write(
      'auth.ts',
      `export const auth = defineAuth({
        trustedOrigins: ['https://a.com', someVariable],
      });`
    );

    expect(getTrustedOriginsFromAuth(authPath)).toEqual(['https://a.com']);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('reads no-substitution template literal entries', () => {
    const authPath = tmp.write(
      'auth.ts',
      `export const auth = defineAuth({
        trustedOrigins: [\`https://a.com\`],
      });`
    );

    expect(getTrustedOriginsFromAuth(authPath)).toEqual(['https://a.com']);
  });

  it('resolves trusted origins when options is a variable reference', () => {
    const authPath = tmp.write(
      'auth.ts',
      `const config = { trustedOrigins: ['https://a.com'] };
       export const auth = defineAuth(config);`
    );

    expect(getTrustedOriginsFromAuth(authPath)).toEqual(['https://a.com']);
  });

  it('resolves trusted origins through a chain of variable references', () => {
    const authPath = tmp.write(
      'auth.ts',
      `const base = { trustedOrigins: ['https://a.com'] };
       const config = base;
       export const auth = defineAuth(config);`
    );

    expect(getTrustedOriginsFromAuth(authPath)).toEqual(['https://a.com']);
  });

  it('resolves trusted origins when options comes from a function declaration', () => {
    const authPath = tmp.write(
      'auth.ts',
      `function getConfig() {
         return { trustedOrigins: ['https://a.com'] };
       }
       export const auth = defineAuth(getConfig());`
    );

    expect(getTrustedOriginsFromAuth(authPath)).toEqual(['https://a.com']);
  });

  it('resolves trusted origins when options comes from a function expression', () => {
    const authPath = tmp.write(
      'auth.ts',
      `const getConfig = function () {
         return { trustedOrigins: ['https://a.com'] };
       };
       export const auth = defineAuth(getConfig());`
    );

    expect(getTrustedOriginsFromAuth(authPath)).toEqual(['https://a.com']);
  });

  it('resolves trusted origins when options comes from an arrow function', () => {
    const authPath = tmp.write(
      'auth.ts',
      `const getConfig = () => ({ trustedOrigins: ['https://a.com'] });
       export const auth = defineAuth(getConfig());`
    );

    expect(getTrustedOriginsFromAuth(authPath)).toEqual(['https://a.com']);
  });

  it('returns an empty array when the options variable cannot be resolved', () => {
    const authPath = tmp.write('auth.ts', `export const auth = defineAuth(config);`);

    expect(getTrustedOriginsFromAuth(authPath)).toEqual([]);
  });

  it('returns an empty array when defineAuth has no argument', () => {
    const authPath = tmp.write('auth.ts', `export const auth = defineAuth();`);

    expect(getTrustedOriginsFromAuth(authPath)).toEqual([]);
  });

  it('returns an empty array when the argument is an unsupported expression', () => {
    const authPath = tmp.write('auth.ts', `export const auth = defineAuth('https://a.com');`);

    expect(getTrustedOriginsFromAuth(authPath)).toEqual([]);
  });

  it('returns an empty array when the factory call is not a plain identifier', () => {
    const authPath = tmp.write('auth.ts', `export const auth = defineAuth(factory.create());`);

    expect(getTrustedOriginsFromAuth(authPath)).toEqual([]);
  });

  it('returns an empty array when the factory variable has no initializer', () => {
    const authPath = tmp.write(
      'auth.ts',
      `let getConfig;
       export const auth = defineAuth(getConfig());`
    );

    expect(getTrustedOriginsFromAuth(authPath)).toEqual([]);
  });

  it('returns an empty array when the factory function cannot be resolved', () => {
    const authPath = tmp.write('auth.ts', `export const auth = defineAuth(getConfig());`);

    expect(getTrustedOriginsFromAuth(authPath)).toEqual([]);
  });

  it('stops resolving circular variable references instead of looping forever', () => {
    const authPath = tmp.write(
      'auth.ts',
      `const a = b;
       const b = a;
       export const auth = defineAuth(a);`
    );

    expect(getTrustedOriginsFromAuth(authPath)).toEqual([]);
  });

  it('warns and skips when trustedOrigins is a shorthand property', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const authPath = tmp.write('auth.ts', `export const auth = defineAuth({ trustedOrigins });`);

    expect(getTrustedOriginsFromAuth(authPath)).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('warns and skips when trustedOrigins is not an array literal', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const authPath = tmp.write('auth.ts', `export const auth = defineAuth({ trustedOrigins: getOrigins() });`);

    expect(getTrustedOriginsFromAuth(authPath)).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });
});
