export const buildRelation = (
  oneRelations: { sourceTable: string; relationName: string; targetTable: string; field: string; reference: string }[],
  manyRelations: { sourceTable: string; relationName: string; targetTable: string }[]
): Map<string, string> => {
  const entries = new Map<string, Map<string, string>>();

  const getOrCreate = (table: string) => {
    let m = entries.get(table);

    if (!m) {
      m = new Map<string, string>();
      entries.set(table, m);
    }

    return m;
  };

  for (const rel of oneRelations) {
    const tableEntries = getOrCreate(rel.sourceTable);

    tableEntries.set(
      rel.relationName,
      `r.one.${rel.targetTable}({\n      from: r.${rel.sourceTable}.${rel.field},\n      to: r.${rel.targetTable}.${rel.reference},\n    })`
    );
  }

  for (const rel of manyRelations) {
    const inverse = oneRelations.find((o) => o.sourceTable === rel.targetTable && o.targetTable === rel.sourceTable);
    const tableEntries = getOrCreate(rel.sourceTable);

    if (inverse) {
      tableEntries.set(
        rel.relationName,
        `r.many.${rel.targetTable}({\n      from: r.${rel.sourceTable}.${inverse.reference},\n      to: r.${rel.targetTable}.${inverse.field},\n    })`
      );
    } else {
      tableEntries.set(rel.relationName, `r.many.${rel.targetTable}()`);
    }
  }

  const result = new Map<string, string>();

  for (const [table, rels] of entries) {
    const inner = [...rels.entries()].map(([name, value]) => `    ${name}: ${value},`).join('\n');

    result.set(table, `{\n${inner}\n  }`);
  }

  return result;
};
