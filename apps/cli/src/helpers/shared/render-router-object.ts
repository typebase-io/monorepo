import { type RouterTreeNode } from '#helpers/shared/build-router-tree.ts';

const isValidIdentifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const renderKey = (name: string) => (isValidIdentifier.test(name) ? name : JSON.stringify(name));

export const renderRouterObject = (node: RouterTreeNode, indent = 2): string => {
  const pad = ' '.repeat(indent);
  const leafEntries = Object.entries(node.leaves).sort(([a], [b]) => a.localeCompare(b));
  const childEntries = Object.entries(node.children).sort(([a], [b]) => a.localeCompare(b));
  const lines: string[] = [];

  for (const [name, value] of leafEntries) {
    lines.push(`${pad}${renderKey(name)}: ${value},`);
  }

  for (const [segment, child] of childEntries) {
    lines.push(`${pad}${renderKey(segment)}: {`);
    lines.push(renderRouterObject(child, indent + 2));
    lines.push(`${pad}},`);
  }

  return lines.join('\n');
};
