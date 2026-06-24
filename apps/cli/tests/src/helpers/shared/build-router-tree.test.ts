import { describe, expect, it } from 'vitest';

import { buildRouterTree } from '#helpers/shared/build-router-tree.ts';

describe('buildRouterTree', () => {
  it('returns an empty tree for no routes', () => {
    expect(buildRouterTree([])).toEqual({ children: {}, leaves: {} });
  });

  it('places top-level leaves on the root node', () => {
    const tree = buildRouterTree([{ pathSegments: [], leaves: { hello: 'fn' } }]);

    expect(tree).toEqual({ children: {}, leaves: { hello: 'fn' } });
  });

  it('nests leaves under their path segments', () => {
    const tree = buildRouterTree([{ pathSegments: ['users', 'admin'], leaves: { list: 'listFn' } }]);

    expect(tree).toEqual({
      children: {
        users: {
          children: { admin: { children: {}, leaves: { list: 'listFn' } } },
          leaves: {},
        },
      },
      leaves: {},
    });
  });

  it('merges leaves that share the same path', () => {
    const tree = buildRouterTree([
      { pathSegments: ['users'], leaves: { list: 'listFn' } },
      { pathSegments: ['users'], leaves: { create: 'createFn' } },
    ]);

    expect(tree).toEqual({
      children: {
        users: { children: {}, leaves: { list: 'listFn', create: 'createFn' } },
      },
      leaves: {},
    });
  });

  it('reuses intermediate nodes across routes', () => {
    const tree = buildRouterTree([
      { pathSegments: ['a', 'b'], leaves: { x: 'xFn' } },
      { pathSegments: ['a', 'c'], leaves: { y: 'yFn' } },
    ]);

    expect(tree).toEqual({
      children: {
        a: {
          children: {
            b: { children: {}, leaves: { x: 'xFn' } },
            c: { children: {}, leaves: { y: 'yFn' } },
          },
          leaves: {},
        },
      },
      leaves: {},
    });
  });
});
