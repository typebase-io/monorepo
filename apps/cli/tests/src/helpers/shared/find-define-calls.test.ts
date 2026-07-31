import { Project, type SourceFile } from 'ts-morph';
import { describe, expect, it } from 'vitest';

import { findDefineCalls } from '#helpers/shared/find-define-calls.ts';

const sourceFileFrom = (code: string): SourceFile => {
  const project = new Project({ useInMemoryFileSystem: true, skipLoadingLibFiles: true });

  return project.createSourceFile('auth.ts', code);
};

describe('findDefineCalls', () => {
  it('finds a call by name', () => {
    const calls = findDefineCalls(sourceFileFrom(`export const auth = defineAuth({});`), 'defineAuth');

    expect(calls).toHaveLength(1);
  });

  it('ignores calls with a different name', () => {
    const calls = findDefineCalls(sourceFileFrom(`export const auth = something({});`), 'defineAuth');

    expect(calls).toHaveLength(0);
  });

  it('finds every matching call in source order', () => {
    const calls = findDefineCalls(sourceFileFrom(`const a = defineAuth({ x: 1 });\nconst b = defineAuth({ x: 2 });`), 'defineAuth');

    expect(calls.map((call) => call.getArguments()[0]?.getText())).toEqual(['{ x: 1 }', '{ x: 2 }']);
  });

  it('does not match a property access with the same trailing name', () => {
    const calls = findDefineCalls(sourceFileFrom(`export const auth = typebase.defineAuth({});`), 'defineAuth');

    expect(calls).toHaveLength(0);
  });

  it('finds nested calls inside a function body', () => {
    const code = `function build() {
  return defineAuth({ a: 1 });
}`;

    expect(findDefineCalls(sourceFileFrom(code), 'defineAuth')).toHaveLength(1);
  });

  it('finds calls for any define function name', () => {
    const calls = findDefineCalls(sourceFileFrom(`export const env = defineEnv({ a: 1 });`), 'defineEnv');

    expect(calls).toHaveLength(1);
  });

  it('returns an empty array when the file has no calls at all', () => {
    expect(findDefineCalls(sourceFileFrom(`export const auth = { a: 1 };`), 'defineAuth')).toEqual([]);
  });
});
