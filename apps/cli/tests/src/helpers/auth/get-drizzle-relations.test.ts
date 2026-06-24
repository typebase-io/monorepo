import { describe, expect, it } from 'vitest';

import { getDrizzleRelations } from '#helpers/auth/get-drizzle-relations.ts';

describe('getDrizzleRelations', () => {
  it('returns empty arrays when there are no relations() calls', () => {
    const { oneRelations, manyRelations } = getDrizzleRelations('export const x = 1;');

    expect(oneRelations).toEqual([]);
    expect(manyRelations).toEqual([]);
  });

  it('ignores variable statements that are not supported relations() calls', () => {
    const code = `let missingInitializer;
    const nonCall = 1;
    const otherCall = createRelations(posts, ({ one }) => ({
      author: one(users, { fields: [posts.authorId], references: [users.id] }),
    }));
    const noSource = relations();
    const noCallback = relations(posts);
    const nonArrowCallback = relations(posts, callback);
    const blockBody = relations(posts, ({ one }) => {
      return {
        author: one(users, { fields: [posts.authorId], references: [users.id] }),
      };
    });`;

    expect(getDrizzleRelations(code)).toEqual({ oneRelations: [], manyRelations: [] });
  });

  it('parses one() relations including their fields and references', () => {
    const code = `export const postsRelations = relations(posts, ({ one }) => ({
      author: one(users, { fields: [posts.authorId], references: [users.id] }),
    }));`;

    const { oneRelations } = getDrizzleRelations(code);

    expect(oneRelations).toEqual([{ sourceTable: 'posts', relationName: 'author', targetTable: 'users', field: 'authorId', reference: 'id' }]);
  });

  it('parses many() relations', () => {
    const code = `export const usersRelations = relations(users, ({ many }) => ({
      posts: many(posts),
    }));`;

    const { manyRelations } = getDrizzleRelations(code);

    expect(manyRelations).toEqual([{ sourceTable: 'users', relationName: 'posts', targetTable: 'posts' }]);
  });

  it('collects relations across multiple relations() declarations', () => {
    const code = `export const usersRelations = relations(users, ({ many }) => ({
      posts: many(posts),
    }));

    export const postsRelations = relations(posts, ({ one }) => ({
      author: one(users, { fields: [posts.authorId], references: [users.id] }),
    }));`;

    const { oneRelations, manyRelations } = getDrizzleRelations(code);

    expect(oneRelations).toEqual([{ sourceTable: 'posts', relationName: 'author', targetTable: 'users', field: 'authorId', reference: 'id' }]);
    expect(manyRelations).toEqual([{ sourceTable: 'users', relationName: 'posts', targetTable: 'posts' }]);
  });

  it('skips unsupported entries in a relations object', () => {
    const code = `const existing = many(posts);

    export const usersRelations = relations(users, ({ many }) => ({
      existing,
      ignoredMethod() {
        return many(posts);
      },
      ...extra,
      notACall: 1,
      unknownCall: makeRelation(posts),
      posts: many(posts),
    }));`;

    const { oneRelations, manyRelations } = getDrizzleRelations(code);

    expect(oneRelations).toEqual([]);
    expect(manyRelations).toEqual([{ sourceTable: 'users', relationName: 'posts', targetTable: 'posts' }]);
  });

  it('ignores one() relations with incomplete fields and references config', () => {
    const code = `const config = { fields: [posts.authorId], references: [users.id] };

    export const postsRelations = relations(posts, ({ one }) => ({
      noConfig: one(users),
      nonObjectConfig: one(users, config),
      noFields: one(users, { references: [users.id] }),
      noReferences: one(users, { fields: [posts.authorId] }),
      shorthandFields: one(users, { fields, references: [users.id] }),
      shorthandReferences: one(users, { fields: [posts.authorId], references }),
      valid: one(users, { fields: [posts.ownerId], references: [users.id] }),
    }));`;

    const { oneRelations } = getDrizzleRelations(code);

    expect(oneRelations).toEqual([{ sourceTable: 'posts', relationName: 'valid', targetTable: 'users', field: 'ownerId', reference: 'id' }]);
  });

  it('ignores relations with no target table argument', () => {
    const code = `export const usersRelations = relations(users, ({ many }) => ({
      posts: many(),
      favoritePost: one(),
    }));`;

    const { oneRelations, manyRelations } = getDrizzleRelations(code);

    expect(oneRelations).toEqual([]);
    expect(manyRelations).toEqual([]);
  });
});
