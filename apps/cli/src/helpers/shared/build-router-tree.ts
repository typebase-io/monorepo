export interface RouterTreeNode {
  children: Record<string, RouterTreeNode>;
  leaves: Record<string, string>;
}

export const buildRouterTree = (routes: { pathSegments: string[]; leaves: Record<string, string> }[]) => {
  const root: RouterTreeNode = { children: {}, leaves: {} };

  for (const route of routes) {
    let node = root;

    for (const segment of route.pathSegments) {
      node.children[segment] ??= { children: {}, leaves: {} };
      node = node.children[segment];
    }

    Object.assign(node.leaves, route.leaves);
  }

  return root;
};
