import { describe, expect, it } from 'vitest';

import { buildRouterTree } from '#helpers/shared/build-router-tree.ts';
import { renderRouterObject } from '#helpers/shared/render-router-object.ts';

describe('renderRouterObject', () => {
  it('renders an empty string for an empty tree', () => {
    expect(renderRouterObject(buildRouterTree([]))).toEqualTemplate('render-router-object', 'empty.txt');
  });

  it('renders leaves with the base indentation', () => {
    const tree = buildRouterTree([{ pathSegments: [], leaves: { hello: 'helloFn' } }]);

    expect(renderRouterObject(tree)).toEqualTemplate('render-router-object', 'single-leaf.txt');
  });

  it('sorts leaves alphabetically', () => {
    const tree = buildRouterTree([{ pathSegments: [], leaves: { zebra: 'z', apple: 'a' } }]);

    expect(renderRouterObject(tree)).toEqualTemplate('render-router-object', 'sorted-leaves.txt');
  });

  it('renders nested children with increasing indentation', () => {
    const tree = buildRouterTree([{ pathSegments: ['users'], leaves: { list: 'listFn' } }]);

    expect(renderRouterObject(tree)).toEqualTemplate('render-router-object', 'nested-child.txt');
  });

  it('renders leaves before children on a node that has both', () => {
    const tree = buildRouterTree([
      { pathSegments: [], leaves: { hello: 'helloFn' } },
      { pathSegments: ['users'], leaves: { list: 'listFn' } },
    ]);

    expect(renderRouterObject(tree)).toEqualTemplate('render-router-object', 'leaves-and-children.txt');
  });

  it('quotes keys that are not valid identifiers', () => {
    const tree = buildRouterTree([{ pathSegments: [], leaves: { 'with-dash': 'fn' } }]);

    expect(renderRouterObject(tree)).toEqualTemplate('render-router-object', 'quoted-key.txt');
  });

  it('sorts sibling child segments alphabetically', () => {
    const tree = buildRouterTree([
      { pathSegments: ['zebra'], leaves: { a: 'aFn' } },
      { pathSegments: ['apple'], leaves: { b: 'bFn' } },
    ]);

    expect(renderRouterObject(tree)).toEqualTemplate('render-router-object', 'sorted-children.txt');
  });
});
