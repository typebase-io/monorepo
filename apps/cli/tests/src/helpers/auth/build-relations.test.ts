import { describe, expect, it } from 'vitest';

import { buildRelation } from '#helpers/auth/build-relations.ts';

describe('buildRelation', () => {
  it('returns an empty map when there are no relations', () => {
    expect(buildRelation([], [])).toEqual(new Map());
  });

  it('renders a one-relation with from/to references', () => {
    expect(buildRelation([{ sourceTable: 'posts', relationName: 'author', targetTable: 'users', field: 'authorId', reference: 'id' }], [])).toEqual(
      new Map([
        [
          'posts',
          `{
    author: r.one.users({
      from: r.posts.authorId,
      to: r.users.id,
    }),
  }`,
        ],
      ])
    );
  });

  it('renders a many-relation with from/to derived from its inverse one-relation', () => {
    expect(
      buildRelation(
        [{ sourceTable: 'posts', relationName: 'author', targetTable: 'users', field: 'authorId', reference: 'id' }],
        [{ sourceTable: 'users', relationName: 'posts', targetTable: 'posts' }]
      )
    ).toEqual(
      new Map([
        [
          'posts',
          `{
    author: r.one.users({
      from: r.posts.authorId,
      to: r.users.id,
    }),
  }`,
        ],
        [
          'users',
          `{
    posts: r.many.posts({
      from: r.users.id,
      to: r.posts.authorId,
    }),
  }`,
        ],
      ])
    );
  });

  it('renders a bare many-relation when no inverse one-relation exists', () => {
    expect(buildRelation([], [{ sourceTable: 'users', relationName: 'posts', targetTable: 'posts' }])).toEqual(
      new Map([
        [
          'users',
          `{
    posts: r.many.posts(),
  }`,
        ],
      ])
    );
  });

  it('renders multiple relations on the same source table in insertion order', () => {
    expect(
      buildRelation(
        [
          { sourceTable: 'posts', relationName: 'author', targetTable: 'users', field: 'authorId', reference: 'id' },
          { sourceTable: 'posts', relationName: 'editor', targetTable: 'users', field: 'editorId', reference: 'id' },
        ],
        [{ sourceTable: 'posts', relationName: 'comments', targetTable: 'comments' }]
      )
    ).toEqual(
      new Map([
        [
          'posts',
          `{
    author: r.one.users({
      from: r.posts.authorId,
      to: r.users.id,
    }),
    editor: r.one.users({
      from: r.posts.editorId,
      to: r.users.id,
    }),
    comments: r.many.comments(),
  }`,
        ],
      ])
    );
  });

  it('lets later relations with the same name overwrite earlier ones for the same source table', () => {
    expect(
      buildRelation(
        [{ sourceTable: 'posts', relationName: 'user', targetTable: 'users', field: 'authorId', reference: 'id' }],
        [{ sourceTable: 'posts', relationName: 'user', targetTable: 'editors' }]
      )
    ).toEqual(
      new Map([
        [
          'posts',
          `{
    user: r.many.editors(),
  }`,
        ],
      ])
    );
  });
});
