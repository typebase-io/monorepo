import type { Node, Type } from 'ts-morph';

export const typeToInlineObject = (type: Type, atNode: Node): string => {
  const lines: string[] = [];
  const props = type.getProperties();

  if (props.length === 0) {
    return type.getText(atNode);
  }

  lines.push('{');

  for (const p of props) {
    const name = p.getEscapedName();
    const decl = p.getDeclarations()[0] ?? atNode;
    const pType = p.getTypeAtLocation(decl);

    lines.push(`  ${name}${p.isOptional() ? '?' : ''}: ${pType.getText(decl)};`);
  }

  lines.push('}');

  return lines.join('\n');
};
