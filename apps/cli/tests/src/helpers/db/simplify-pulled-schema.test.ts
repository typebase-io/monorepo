import { describe, expect, it } from 'vitest';

import { simplifyPulledSchema } from '#helpers/db/simplify-pulled-schema.ts';

import { removeExtraSpaces } from '#tests/helpers/remove-extra-spaces.ts';

describe('simplifyPulledSchema', () => {
  it('writes a now() default as defaultNow()', () => {
    const source = removeExtraSpaces(`
      export const logs = p.pgTable('logs', {
        createdAt: p.timestamp('created_at').default(q.sql\`now()\`).notNull(),
      });
    `);

    expect(simplifyPulledSchema(source)).toEqualTemplate('db-pull', 'simplify', 'default-now.ts.txt');
  });

  it('drops index options that are already the default', () => {
    const source = removeExtraSpaces(`
      export const logs = p.pgTable('logs', {
        userId: p.text('user_id'),
      }, (table) => [
        p.index('logs_user_id_idx').using('btree', table.userId.asc().nullsLast()),
      ]);
    `);

    expect(simplifyPulledSchema(source)).toEqualTemplate('db-pull', 'simplify', 'index-defaults.ts.txt');
  });

  it('keeps an index that asks for something other than the defaults', () => {
    const source = removeExtraSpaces(`
      export const logs = p.pgTable('logs', {
        userId: p.text('user_id'),
      }, (table) => [
        p.index('logs_user_id_idx').using('hash', table.userId.asc().nullsLast()),
        p.index('logs_created_at_idx').using('btree', table.createdAt.desc().nullsFirst()),
      ]);
    `);

    expect(simplifyPulledSchema(source)).toBe(source);
  });

  it('moves a single-column unique onto its column and drops the empty callback', () => {
    const source = removeExtraSpaces(`
      export const users = p.pgTable('users', {
        email: p.text().notNull(),
      }, (table) => [
        p.unique('users_email_key').on(table.email),
      ]);
    `);

    expect(simplifyPulledSchema(source)).toEqualTemplate('db-pull', 'simplify', 'inline-unique.ts.txt');
  });

  it('keeps the callback when it still holds something else', () => {
    const source = removeExtraSpaces(`
      export const users = p.pgTable('users', {
        email: p.text().notNull(),
        userId: p.text('user_id'),
      }, (table) => [
        p.unique('users_email_key').on(table.email),
        p.index('users_user_id_idx').on(table.userId),
      ]);
    `);

    expect(simplifyPulledSchema(source)).toEqualTemplate('db-pull', 'simplify', 'inline-unique-with-index.ts.txt');
  });

  it('steps over entries in the callback that are not calls', () => {
    const source = removeExtraSpaces(`
      export const users = p.pgTable('users', {
        email: p.text().notNull(),
      }, (table) => [
        extraConstraint,
        p.unique('users_email_key').on(table.email),
      ]);
    `);

    expect(simplifyPulledSchema(source)).toEqualTemplate('db-pull', 'simplify', 'non-call-entry.ts.txt');
  });

  it('inlines a unique written inline, without a trailing comma to remove', () => {
    const source = removeExtraSpaces(`
      export const users = p.pgTable('users', {
        email: p.text().notNull(),
        userId: p.text('user_id'),
      }, (table) => [p.index('users_user_id_idx').on(table.userId), p.unique('users_email_key').on(table.email)]);
    `);

    expect(simplifyPulledSchema(source)).toEqualTemplate('db-pull', 'simplify', 'inline-unique-same-line.ts.txt');
  });

  it('leaves a unique that covers more than one column alone', () => {
    const source = removeExtraSpaces(`
      export const follows = p.pgTable('follows', {
        followerId: p.text('follower_id'),
        followingId: p.text('following_id'),
      }, (table) => [
        p.unique('follows_pair_key').on(table.followerId, table.followingId),
      ]);
    `);

    expect(simplifyPulledSchema(source)).toBe(source);
  });
});
