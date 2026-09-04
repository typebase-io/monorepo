import { Project, SyntaxKind } from 'ts-morph';
import { describe, expect, it } from 'vitest';

import { hasDynamicAuthOptions } from '#helpers/shared/has-dynamic-auth-options.ts';

describe('hasDynamicAuthOptions', () => {
  it.each([
    { name: 'empty options', source: '{}', expected: false },
    { name: 'a literal property', source: '{ basePath: "/mine" }', expected: false },
    { name: 'a quoted property name', source: '{ "basePath": "/mine" }', expected: false },
    { name: 'a shorthand property', source: '{ basePath }', expected: false },
    { name: 'a dynamic value with a fixed property name', source: '{ basePath: process.env.AUTH_PATH }', expected: false },
    { name: 'spread options', source: '{ ...defaults }', expected: true },
    { name: 'spread options after a literal property', source: '{ basePath: "/mine", ...overrides }', expected: true },
    { name: 'a computed literal property name', source: '{ ["basePath"]: "/mine" }', expected: true },
    { name: 'a computed property name after a literal property', source: '{ basePath: "/mine", [key]: value }', expected: true },
    { name: 'a spread confined to nested options', source: '{ emailAndPassword: { ...defaults } }', expected: false },
    { name: 'a computed property confined to nested options', source: '{ emailAndPassword: { [key]: true } }', expected: false },
  ])('returns $expected for $name', ({ source, expected }) => {
    const project = new Project({ useInMemoryFileSystem: true, skipLoadingLibFiles: true });
    const sourceFile = project.createSourceFile('auth.ts', `const options = ${source};`);
    const options = sourceFile.getVariableDeclarationOrThrow('options').getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);

    expect(hasDynamicAuthOptions(options)).toBe(expected);
  });
});
