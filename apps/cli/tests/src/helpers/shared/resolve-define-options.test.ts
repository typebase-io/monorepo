import { Project, type SourceFile } from 'ts-morph';
import { describe, expect, it } from 'vitest';

import { findDefineCalls } from '#helpers/shared/find-define-calls.ts';
import { resolveDefineOptions } from '#helpers/shared/resolve-define-options.ts';

const sourceFileFrom = (code: string): SourceFile => {
  const project = new Project({ useInMemoryFileSystem: true, skipLoadingLibFiles: true });

  return project.createSourceFile('auth.ts', code);
};

const resolveFirst = (code: string, functionName = 'defineAuth') => {
  const [call] = findDefineCalls(sourceFileFrom(code), functionName);

  return call ? resolveDefineOptions(call) : undefined;
};

describe('resolveDefineOptions', () => {
  it('resolves an inline object literal', () => {
    expect(resolveFirst(`export const auth = defineAuth({ a: 1 });`)?.getText()).toBe('{ a: 1 }');
  });

  it('resolves a variable reference', () => {
    const code = `const config = { a: 1 };
export const auth = defineAuth(config);`;

    expect(resolveFirst(code)?.getText()).toBe('{ a: 1 }');
  });

  it('resolves through a chain of variable references', () => {
    const code = `const base = { a: 1 };
const config = base;
export const auth = defineAuth(config);`;

    expect(resolveFirst(code)?.getText()).toBe('{ a: 1 }');
  });

  it('resolves through a parenthesized expression', () => {
    expect(resolveFirst(`export const auth = defineAuth(({ a: 1 }));`)?.getText()).toBe('{ a: 1 }');
  });

  it('resolves through an as expression', () => {
    expect(resolveFirst(`export const auth = defineAuth({ a: 1 } as Options);`)?.getText()).toBe('{ a: 1 }');
  });

  it('resolves through a satisfies expression', () => {
    expect(resolveFirst(`export const auth = defineAuth({ a: 1 } satisfies Options);`)?.getText()).toBe('{ a: 1 }');
  });

  it('resolves a function declaration that returns an object literal', () => {
    const code = `function getConfig() {
  return { a: 1 };
}
export const auth = defineAuth(getConfig());`;

    expect(resolveFirst(code)?.getText()).toBe('{ a: 1 }');
  });

  it('resolves a function expression that returns an object literal', () => {
    const code = `const getConfig = function () {
  return { a: 1 };
};
export const auth = defineAuth(getConfig());`;

    expect(resolveFirst(code)?.getText()).toBe('{ a: 1 }');
  });

  it('resolves an arrow function with a concise body', () => {
    const code = `const getConfig = () => ({ a: 1 });
export const auth = defineAuth(getConfig());`;

    expect(resolveFirst(code)?.getText()).toBe('{ a: 1 }');
  });

  it('resolves an arrow function with a block body', () => {
    const code = `const getConfig = () => {
  return { a: 1 };
};
export const auth = defineAuth(getConfig());`;

    expect(resolveFirst(code)?.getText()).toBe('{ a: 1 }');
  });

  it('returns undefined when there is no argument', () => {
    expect(resolveFirst(`export const auth = defineAuth();`)).toBeUndefined();
  });

  it('returns undefined for an unsupported expression', () => {
    expect(resolveFirst(`export const auth = defineAuth('nope');`)).toBeUndefined();
  });

  it('returns undefined when the identifier cannot be resolved', () => {
    expect(resolveFirst(`export const auth = defineAuth(config);`)).toBeUndefined();
  });

  it('returns undefined when the referenced variable does not hold an object literal', () => {
    const code = `const config = makeConfig();
export const auth = defineAuth(config);`;

    expect(resolveFirst(code)).toBeUndefined();
  });

  it('returns undefined when the factory call is not a plain identifier', () => {
    expect(resolveFirst(`export const auth = defineAuth(factory.create());`)).toBeUndefined();
  });

  it('returns undefined when the factory variable has no initializer', () => {
    const code = `let getConfig;
export const auth = defineAuth(getConfig());`;

    expect(resolveFirst(code)).toBeUndefined();
  });

  it('returns undefined when the factory function cannot be resolved', () => {
    expect(resolveFirst(`export const auth = defineAuth(getConfig());`)).toBeUndefined();
  });

  it('stops at the depth limit instead of looping on circular references', () => {
    const code = `const a = b;
const b = a;
export const auth = defineAuth(a);`;

    expect(resolveFirst(code)).toBeUndefined();
  });

  it('gives up past the depth limit even when a literal exists further down the chain', () => {
    const chain = Array.from({ length: 12 }, (_, index) => `const v${index} = v${index + 1};`).join('\n');
    const code = `${chain}
const v12 = { a: 1 };
export const auth = defineAuth(v0);`;

    expect(resolveFirst(code)).toBeUndefined();
  });

  it('resolves for any define function name, not just defineAuth', () => {
    expect(resolveFirst(`export const env = defineEnv({ a: 1 });`, 'defineEnv')?.getText()).toBe('{ a: 1 }');
  });
});
