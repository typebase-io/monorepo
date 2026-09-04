import { Project, SyntaxKind } from 'ts-morph';
import { describe, expect, it } from 'vitest';

import { getAuthBasePathProperty } from '#helpers/shared/get-auth-base-path-property.ts';

describe('getAuthBasePathProperty', () => {
  it.each([
    { name: 'an identifier key', source: '{ basePath: "/mine" }', expected: 'basePath: "/mine"' },
    { name: 'a double-quoted key', source: '{ "basePath": "/mine" }', expected: '"basePath": "/mine"' },
    { name: 'a single-quoted key', source: "{ 'basePath': '/mine' }", expected: "'basePath': '/mine'" },
    { name: 'a shorthand property', source: '{ basePath }', expected: 'basePath' },
    { name: 'a computed string key', source: '{ ["basePath"]: "/mine" }', expected: '["basePath"]: "/mine"' },
    { name: 'a dynamic value', source: '{ basePath: process.env.AUTH_PATH }', expected: 'basePath: process.env.AUTH_PATH' },
    { name: 'a getter', source: '{ get basePath() { return "/mine"; } }', expected: 'get basePath() { return "/mine"; }' },
    { name: 'a property following a spread', source: '{ ...defaults, basePath: "/mine" }', expected: 'basePath: "/mine"' },
    { name: 'empty options', source: '{}', expected: undefined },
    { name: 'spread-only options', source: '{ ...defaults }', expected: undefined },
    { name: 'an unrelated property', source: '{ baseURL: "https://example.com" }', expected: undefined },
    { name: 'an unrelated computed string key', source: '{ ["baseURL"]: "https://example.com" }', expected: undefined },
    { name: 'an unresolved computed identifier', source: '{ [basePath]: "/mine" }', expected: undefined },
    { name: 'a nested base path', source: '{ plugin: { basePath: "/mine" } }', expected: undefined },
  ])('finds only the auth base path for $name', ({ source, expected }) => {
    const project = new Project({ useInMemoryFileSystem: true, skipLoadingLibFiles: true });
    const sourceFile = project.createSourceFile('auth.ts', `const options = ${source};`);
    const options = sourceFile.getVariableDeclarationOrThrow('options').getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);

    expect(getAuthBasePathProperty(options)?.getText()).toBe(expected);
  });
});
