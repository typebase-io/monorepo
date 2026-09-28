import { Project, SyntaxKind } from 'ts-morph';
import { describe, expect, it } from 'vitest';

import { readStringProperty } from '#helpers/shared/read-string-property.ts';

describe('readStringProperty', () => {
  const objectOf = (source: string) =>
    new Project({ useInMemoryFileSystem: true })
      .createSourceFile('storage.ts', `const options = ${source};`)
      .getFirstDescendantByKindOrThrow(SyntaxKind.ObjectLiteralExpression);

  it('reads a property written as a plain string', () => {
    expect(readStringProperty(objectOf('{ region: "iad1" }'), 'region', 'storage.ts')).toBe('iad1');
  });

  it('is undefined when the object has no such property', () => {
    expect(readStringProperty(objectOf('{ region: "iad1" }'), 'locationHint', 'storage.ts')).toBeUndefined();
  });

  it.each([
    { name: 'a variable', source: '{ region: chosenRegion }' },
    { name: 'a template literal', source: '{ region: `iad1` }' },
    { name: 'a shorthand property', source: '{ region }' },
  ])('refuses a property written as $name, since it cannot be read without running the file', ({ source }) => {
    expect(() => readStringProperty(objectOf(source), 'region', 'storage.ts')).toThrow(
      'Could not read `region` in `storage.ts`. Write it as a plain string so the CLI can read it.'
    );
  });
});
