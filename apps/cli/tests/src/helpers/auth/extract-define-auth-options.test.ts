import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extractDefineAuthOptions } from '#helpers/auth/extract-define-auth-options.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('extractDefineAuthOptions', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('returns the options of the first export that carries an options property', async () => {
    const authPath = tmp.write('auth.ts', `export const auth = { options: { emailAndPassword: { enabled: true } } };`);

    expect(await extractDefineAuthOptions(authPath)).toEqual({ emailAndPassword: { enabled: true } });
  });

  it('returns defineAuth options passed through a variable', async () => {
    const authPath = tmp.write(
      'auth.ts',
      `const defineAuth = (options: Record<string, unknown>) => ({ options });
       const options = { emailAndPassword: { enabled: true } };
       export const auth = defineAuth(options);`
    );

    expect(await extractDefineAuthOptions(authPath)).toEqual({ emailAndPassword: { enabled: true } });
  });

  it('returns defineAuth options loaded from a function', async () => {
    const authPath = tmp.write(
      'auth.ts',
      `const defineAuth = (options: Record<string, unknown>) => ({ options });
       function getOptions() {
         return { trustedOrigins: ['https://example.com'] };
       }
       export const auth = defineAuth(getOptions());`
    );

    expect(await extractDefineAuthOptions(authPath)).toEqual({ trustedOrigins: ['https://example.com'] });
  });

  it('skips primitive and option-less exports', async () => {
    const authPath = tmp.write(
      'auth.ts',
      `export const name = "my-app";
       export const plain = { foo: "bar" };
       export const auth = { options: { baseURL: "https://example.com" } };`
    );

    expect(await extractDefineAuthOptions(authPath)).toEqual({ baseURL: 'https://example.com' });
  });

  it('returns an empty object when no export has options', async () => {
    const authPath = tmp.write('auth.ts', `export const config = { foo: "bar" };`);

    expect(await extractDefineAuthOptions(authPath)).toEqual({});
  });
});
