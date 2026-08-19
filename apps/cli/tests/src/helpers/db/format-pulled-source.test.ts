import { describe, expect, it } from 'vitest';

import { formatPulledSource } from '#helpers/db/format-pulled-source.ts';

import { removeExtraSpaces } from '#tests/helpers/remove-extra-spaces.ts';

describe('formatPulledSource', () => {
  it('indents with two spaces instead of tabs', () => {
    const source = removeExtraSpaces(`
      export const logs = pgTable("logs", {
        id: integer(),
        message: text(),
      });
    `);

    expect(formatPulledSource(source)).toEqualTemplate('db-pull', 'format', 'tabs.ts.txt');
  });

  it('moves the closing bracket of a multi-line array onto its own line', () => {
    const source = removeExtraSpaces(`
      const extras = [
        index("a"),
        unique("b"),];
    `);

    expect(formatPulledSource(source)).toEqualTemplate('db-pull', 'format', 'multi-line-array.ts.txt');
  });

  it('terminates statements that were written without a semicolon', () => {
    const source = removeExtraSpaces(`
      export const relations = defineRelations(schema, (r) => ({
        logs: {},
      }))
    `);

    expect(formatPulledSource(source)).toEqualTemplate('db-pull', 'format', 'semicolons.ts.txt');
  });

  it('rewrites double-quoted strings as single-quoted ones', () => {
    const source = removeExtraSpaces(`
      const name = "logs";
    `);

    expect(formatPulledSource(source)).toEqualTemplate('db-pull', 'format', 'single-quotes.ts.txt');
  });

  it('leaves a string that already contains a single quote alone', () => {
    const source = removeExtraSpaces(`
      const status = "it's open";
    `);

    expect(formatPulledSource(source)).toEqualTemplate('db-pull', 'format', 'quote-in-string.ts.txt');
  });

  it('leaves a string with an escape sequence alone', () => {
    const source = removeExtraSpaces(`
      const label = "line\\nbreak";
    `);

    expect(formatPulledSource(source)).toEqualTemplate('db-pull', 'format', 'escaped-string.ts.txt');
  });

  it('leaves the contents of a template literal alone', () => {
    const source = removeExtraSpaces(`
      const view = sql\`SELECT * FROM todos WHERE status = 'open'\`;
    `);

    expect(formatPulledSource(source)).toEqualTemplate('db-pull', 'format', 'template-literal.ts.txt');
  });

  it('leaves arrays that need no help alone', () => {
    const source = removeExtraSpaces(`
      const single = ['a', 'b'];

      const empty = [];

      const multi = [
        'a',
      ];
    `);

    expect(formatPulledSource(source)).toEqualTemplate('db-pull', 'format', 'untouched-arrays.ts.txt');
  });

  it('collapses runs of blank lines', () => {
    const source = removeExtraSpaces(`
      const a = 1;




      const b = 2;
    `);

    expect(formatPulledSource(source)).toEqualTemplate('db-pull', 'format', 'blank-lines.ts.txt');
  });

  it('keeps a blank line between top-level declarations that were written without one', () => {
    const source = removeExtraSpaces(`
      export const a = 1;
      export const b = 2;
    `);

    expect(formatPulledSource(source)).toEqualTemplate('db-pull', 'format', 'top-level-spacing.ts.txt');
  });
});
