import { describe, expect, it } from 'vitest';

import { rewriteDrizzleImports } from '#helpers/db/rewrite-drizzle-imports.ts';

import { removeExtraSpaces } from '#tests/helpers/remove-extra-spaces.ts';

describe('rewriteDrizzleImports', () => {
  it('moves `drizzle-orm/pg-core` helpers onto `p` and `drizzle-orm` helpers onto `q`', () => {
    const source = removeExtraSpaces(`
      import { pgTable, text } from "drizzle-orm/pg-core"
      import { sql } from "drizzle-orm"

      export const logs = pgTable("logs", {
        message: text().default(sql\`''\`),
      });
    `);

    expect(rewriteDrizzleImports(source)).toEqualTemplate('db-pull', 'rewrite', 'both-namespaces.ts.txt');
  });

  it('leaves helper names that only appear inside a `sql` template alone', () => {
    const source = removeExtraSpaces(`
      import { pgView, integer } from "drizzle-orm/pg-core"
      import { sql } from "drizzle-orm"

      export const counts = pgView("counts", { total: integer() }).as(sql\`SELECT integer(1) AS total\`);
    `);

    expect(rewriteDrizzleImports(source)).toEqualTemplate('db-pull', 'rewrite', 'sql-template.ts.txt');
  });

  it('leaves property names that happen to match a helper alone', () => {
    const source = removeExtraSpaces(`
      import { pgTable, text, index } from "drizzle-orm/pg-core"

      export const logs = pgTable("logs", {
        text: text(),
      }, (table) => [index("logs_text_idx").on(table.text)]);
    `);

    expect(rewriteDrizzleImports(source)).toEqualTemplate('db-pull', 'rewrite', 'property-names.ts.txt');
  });

  it('imports only the namespaces the file actually uses', () => {
    const source = removeExtraSpaces(`
      import { pgTable } from "drizzle-orm/pg-core"
      import { sql } from "drizzle-orm"

      export const logs = pgTable("logs", {});
    `);

    expect(rewriteDrizzleImports(source)).toEqualTemplate('db-pull', 'rewrite', 'unused-namespace.ts.txt');
  });

  it('returns the source untouched when it has no drizzle imports', () => {
    const source = removeExtraSpaces(`
      import { p } from 'typebase-io/db';

      export const logs = p.pgTable('logs', {});
    `);

    expect(rewriteDrizzleImports(source)).toBe(source);
  });
});
